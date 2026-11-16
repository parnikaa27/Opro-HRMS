-- The documents Opro keeps for each person. HR manages the list: who uploads each one, whether it expires,
-- and whether only expatriates need it. A type that has been used is retired rather than deleted.
create table document_type (
    code                 varchar(40)  primary key,
    name                 varchar(60)  not null,
    uploaded_by          varchar(8)   not null check (uploaded_by in ('employee', 'hr')),
    has_expiry           boolean      not null,
    for_expatriates_only boolean      not null,
    sort_order           integer      not null,
    retired_on           date
);
create unique index document_type_active_name on document_type (lower(name)) where retired_on is null;

-- The documents already on file become HR's types, one per name.
insert into document_type (code, name, uploaded_by, has_expiry, for_expatriates_only, sort_order)
select lower(regexp_replace(name, '[^A-Za-z0-9]+', '-', 'g')), name, 'hr', bool_or(expires_on is not null), false, min(sort_order)
from employee_document
group by name;

-- One document per type per person. An employee's upload waits for HR, who verifies it or sends it back with a reason.
alter table employee_document add column type_code varchar(40) references document_type (code);
update employee_document set type_code = lower(regexp_replace(name, '[^A-Za-z0-9]+', '-', 'g'));
alter table employee_document alter column type_code set not null;
alter table employee_document drop column name, drop column sort_order;
alter table employee_document drop constraint employee_document_status_check;
alter table employee_document add constraint employee_document_status_check check (status in ('pending', 'verified', 'rejected'));
alter table employee_document add column uploaded_by   varchar(16)  references employee (id);
alter table employee_document add column decided_by    varchar(16)  references employee (id);
alter table employee_document add column decided_on    date;
alter table employee_document add column decision_note varchar(300);
alter table employee_document add constraint employee_document_note_check check (status <> 'rejected' or decision_note is not null);
create unique index employee_document_one_per_type on employee_document (employee_id, type_code);
