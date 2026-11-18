-- More of each person on their record, from HR's requirements: gender and date of birth for the dashboard and
-- birthdays, when probation and a contract end, and the job category their expatriate quota slot comes from.
alter table employee add column gender varchar(6) check (gender in ('male', 'female'));
alter table employee add column date_of_birth date;
alter table employee add column probation_ends_on date;
alter table employee add column contract_ends_on date;
alter table employee add column job_category varchar(80);
update employee set employment_type = 'Permanent' where employment_type = 'Full-time';
alter table employee add constraint employee_employment_type_check check (employment_type in ('Permanent', 'Contract', 'Casual', 'Intern'));

-- An expatriate's employment approval and the medical their work permit needs.
alter table visa add column employment_approval_number varchar(40);
alter table visa add column employment_approval_expiry date;
alter table visa add column medical_due_on date;

-- Medical insurance, for anyone who has it through Opro.
create table medical_insurance (
    employee_id   varchar(16) primary key references employee (id),
    provider      varchar(80) not null,
    policy_number varchar(40) not null,
    expires_on    date        not null
);

-- Bank details for payroll. The employee enters them; HR verifies them, or sends them back with a reason.
create table bank_account (
    employee_id    varchar(16)  primary key references employee (id),
    bank_name      varchar(80)  not null,
    account_name   varchar(120) not null,
    account_number varchar(40)  not null,
    currency       varchar(3)   not null check (currency in ('MVR', 'USD')),
    status         varchar(10)  not null check (status in ('pending', 'verified', 'rejected')),
    submitted_on   date         not null,
    decided_by     varchar(16)  references employee (id),
    decided_on     date,
    decision_note  varchar(300),
    check (status <> 'rejected' or decision_note is not null)
);

create table education (
    id             varchar(16)  primary key,
    employee_id    varchar(16)  not null references employee (id),
    qualification  varchar(120) not null,
    institution    varchar(120) not null,
    completed_year integer      not null check (completed_year between 1950 and 2100)
);
create index education_employee on education (employee_id);

create table work_experience (
    id          varchar(16)  primary key,
    employee_id varchar(16)  not null references employee (id),
    employer    varchar(120) not null,
    role        varchar(120) not null,
    from_date   date         not null,
    to_date     date,
    check (to_date is null or to_date >= from_date)
);
create index work_experience_employee on work_experience (employee_id);

-- The Ministry's expatriate quota: slots granted for a job category, until a date. Used slots are counted from
-- the active expatriates with that job category, never stored.
create table quota_approval (
    id              varchar(16) primary key,
    job_category    varchar(80) not null,
    slots           integer     not null check (slots > 0),
    approval_number varchar(40) not null,
    approved_on     date        not null,
    expires_on      date        not null,
    check (expires_on > approved_on)
);

-- The reminder log now covers more than visas and passports.
alter table visa_reminder drop constraint visa_reminder_document_check;
alter table visa_reminder alter column document type varchar(12);
alter table visa_reminder add constraint visa_reminder_document_check
    check (document in ('visa', 'passport', 'medical', 'insurance', 'approval', 'contract', 'probation', 'birthday', 'anniversary'));
