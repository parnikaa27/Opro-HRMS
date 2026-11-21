-- A document can have several files: the pages of a passport, each certificate. The document keeps its status and
-- dates, and its files hang off it.
create table document_file (
    id          varchar(24) primary key,
    document_id varchar(24) not null references employee_document (id) on delete cascade,
    file_id     uuid        not null references stored_file (id),
    uploaded_by varchar(16) not null references employee (id),
    uploaded_on date        not null
);
create index document_file_document on document_file (document_id);

insert into document_file (id, document_id, file_id, uploaded_by, uploaded_on)
select 'DF-' || substr(md5(id), 1, 12), id, file_id, coalesce(uploaded_by, employee_id), coalesce(updated_on, current_date)
from employee_document
where file_id is not null;
alter table employee_document drop column file_id;

-- Every document has the date it starts. The date it ends is kept for types that expire.
alter table employee_document add column issued_on date;

-- HR sets how many days before expiry each type reminds, and can ask one person for a type nobody else needs.
alter table document_type
    add column remind_days_before integer not null default 30 check (remind_days_before between 1 and 365),
    add column is_for_everyone    boolean not null default true;

create table document_type_person (
    type_code   varchar(40) not null references document_type (code),
    employee_id varchar(16) not null references employee (id),
    primary key (type_code, employee_id)
);

-- Uploaded documents that expire are reminded about too, logged as doc: and their type.
alter table visa_reminder drop constraint visa_reminder_document_check;
alter table visa_reminder alter column document type varchar(48);
alter table visa_reminder add constraint visa_reminder_document_check
    check (document in ('visa', 'passport', 'medical', 'insurance', 'approval', 'contract', 'probation', 'birthday', 'anniversary') or document like 'doc:%');
