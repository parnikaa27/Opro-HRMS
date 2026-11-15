-- Leave types HR manages from Policies.
-- is_for_everyone: everyone gets it each year. Otherwise HR gives it to people one by one (maternity, marriage).
-- carries_forward: unused days move into the next year, up to carry_forward_cap. Otherwise they lapse.
-- retired_on: no longer offered. Past requests and balances stay readable.
alter table leave_type add column is_for_everyone boolean not null default true;
alter table leave_type add column carries_forward boolean not null default false;
alter table leave_type add column carry_forward_cap numeric(5, 1) check (carry_forward_cap >= 0);
alter table leave_type add column retired_on date;
alter table leave_type add constraint leave_type_carry_needs_cap check (not carries_forward or carry_forward_cap is not null);
update leave_type set is_for_everyone = false where code in ('maternity', 'paternity');

-- HR can take a type away from one person. Their history stays; they just can't book it any more.
alter table leave_entitlement add column removed_on date;

-- Compensatory off is earned, never given by the policy, and lapses at the end of the year.
insert into leave_type (code, name, allows_half_day, is_unlimited, default_entitlement, document_required_after_days, sort_order, is_for_everyone)
values ('comp-off', 'Compensatory off', true, false, null, null, 90, false)
on conflict (code) do nothing;

-- Punching on a Friday or a public holiday asks the manager for compensatory off. Approved, it adds a day,
-- or half a day for a short one, to that year's compensatory off.
create table comp_off_claim (
    id            varchar(16)   primary key,
    employee_id   varchar(16)   not null references employee (id),
    work_date     date          not null,
    status        varchar(10)   not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    days          numeric(2, 1) check (days in (0.5, 1)),
    decided_by    varchar(16)   references employee (id),
    decided_on    date,
    decision_note varchar(300),
    unique (employee_id, work_date)
);
create index comp_off_claim_status on comp_off_claim (status, work_date);

alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
    check (kind in ('approval', 'leave', 'visa', 'correction', 'holiday', 'announcement', 'record', 'schedule', 'home', 'flight'));
