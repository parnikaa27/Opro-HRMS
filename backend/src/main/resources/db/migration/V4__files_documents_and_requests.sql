-- Uploaded and stored files: photos, medical certificates, documents. Kept in the database for now, so they sit
-- inside the same transactions and backups as everything else. Moving to object storage later only touches this table.
create table stored_file (
    id           uuid         primary key,
    content_type varchar(40)  not null check (content_type in ('image/jpeg', 'image/png', 'application/pdf')),
    bytes        bytea        not null,
    size_bytes   integer      not null check (size_bytes > 0),
    uploaded_by  varchar(16)  not null references employee (id),
    uploaded_at  timestamptz  not null
);

-- One ID card photo per person. The version goes in the photo's URL, so a new photo is never hidden behind a cached old one.
create table employee_photo (
    employee_id varchar(16) primary key references employee (id),
    file_id     uuid        not null references stored_file (id),
    version     varchar(16) not null
);

-- A medical certificate attached to sick leave. Health data: the employee and HR can open it, managers can't.
alter table leave_request add column certificate_file_id uuid references stored_file (id);

create table employee_document (
    id          varchar(24)  primary key,
    employee_id varchar(16)  not null references employee (id),
    name        varchar(80)  not null,
    status      varchar(10)  not null check (status in ('verified', 'pending')),
    updated_on  date,
    expires_on  date,
    file_id     uuid         references stored_file (id),
    sort_order  integer      not null
);
create index employee_document_employee on employee_document (employee_id, sort_order);

create table announcement (
    id           varchar(16)  primary key,
    title        varchar(80)  not null,
    body         varchar(500) not null,
    published_on date         not null
);

-- Someone asking HR to change their personal details. HR works through these in the inbox.
create table change_request (
    id            varchar(16)  primary key,
    employee_id   varchar(16)  not null references employee (id),
    field         varchar(40)  not null,
    details       varchar(300) not null,
    status        varchar(10)  not null default 'open' check (status in ('open', 'done', 'declined')),
    raised_on     date         not null,
    decided_by    varchar(16)  references employee (id),
    decided_on    date,
    decision_note varchar(300)
);
create index change_request_status on change_request (status, raised_on);
