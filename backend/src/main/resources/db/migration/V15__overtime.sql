-- Time worked past the end of the shift on a working day, for the HOD to approve. minutes is set on approval,
-- from the punches then, ready for payroll.
create table overtime_claim (
    id            varchar(16)  primary key,
    employee_id   varchar(16)  not null references employee (id),
    work_date     date         not null,
    status        varchar(10)  not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    minutes       integer      check (minutes > 0),
    decided_by    varchar(16)  references employee (id),
    decided_on    date,
    decision_note varchar(300),
    unique (employee_id, work_date)
);
create index overtime_claim_status on overtime_claim (status, work_date);

alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
    check (kind in ('approval', 'leave', 'visa', 'correction', 'holiday', 'announcement', 'record', 'schedule', 'home', 'flight', 'overtime'));
