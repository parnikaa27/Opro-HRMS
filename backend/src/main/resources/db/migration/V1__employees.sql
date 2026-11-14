-- People and their papers. Manager access is never stored: anyone with an active report is a manager.
create table employee (
    id                 varchar(16)  primary key,
    full_name          varchar(120) not null,
    designation        varchar(120) not null,
    department         varchar(120) not null,
    email              varchar(120) not null,
    phone              varchar(40)  not null,
    joined_on          date         not null,
    blood_group        varchar(3)   not null check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    nationality        varchar(60)  not null,
    work_location      varchar(60)  not null,
    employment_type    varchar(30)  not null,
    manager_id         varchar(16)  references employee (id),
    is_hr              boolean      not null default false,
    emergency_name     varchar(120) not null,
    emergency_relation varchar(60)  not null,
    emergency_phone    varchar(40)  not null,
    -- Set when someone is leaving. Nobody is ever deleted, their records stay.
    last_day           date,
    leaving_reason     varchar(300),
    check (manager_id <> id)
);

create unique index employee_email_unique on employee (lower(email));
create index employee_manager on employee (manager_id);

-- Only expatriate staff have a visa. The passport is stored as its last 4 characters, never in full.
create table visa (
    employee_id        varchar(16) primary key references employee (id),
    work_permit_number varchar(40) not null,
    visa_number        varchar(40) not null,
    passport_last4     varchar(4)  not null check (length(passport_last4) = 4),
    passport_expiry    date        not null,
    visa_issued_on     date        not null,
    visa_expiry        date        not null,
    check (visa_expiry > visa_issued_on)
);
