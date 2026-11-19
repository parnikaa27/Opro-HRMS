-- Allowances on top of pay, kept for payroll. HR keeps the list of kinds.
create table allowance_type (
    code       varchar(40) primary key,
    name       varchar(60) not null,
    sort_order integer     not null,
    retired_on date
);
create unique index allowance_type_active_name on allowance_type (lower(name)) where retired_on is null;
insert into allowance_type (code, name, sort_order)
values ('housing', 'Housing', 1), ('food', 'Food', 2), ('transport', 'Transport', 3), ('phone', 'Phone', 4);

-- What someone gets every month, from a month on. A change ends the old amount and starts a new one, so history stays.
create table monthly_allowance (
    id          varchar(16)    primary key,
    employee_id varchar(16)    not null references employee (id),
    type_code   varchar(40)    not null references allowance_type (code),
    amount      numeric(10, 2) not null check (amount > 0),
    currency    varchar(3)     not null check (currency in ('MVR', 'USD')),
    starts_on   date           not null check (extract(day from starts_on) = 1),
    ends_on     date,
    note        varchar(300),
    set_by      varchar(16)    not null references employee (id),
    set_on      date           not null,
    check (ends_on is null or ends_on >= starts_on)
);
create index monthly_allowance_employee on monthly_allowance (employee_id);

-- A one-off amount an HOD grants a report, with a reason. HR approves it, or declines with a reason.
create table allowance_grant (
    id            varchar(16)    primary key,
    employee_id   varchar(16)    not null references employee (id),
    type_code     varchar(40)    not null references allowance_type (code),
    amount        numeric(10, 2) not null check (amount > 0),
    currency      varchar(3)     not null check (currency in ('MVR', 'USD')),
    reason        varchar(300)   not null,
    status        varchar(10)    not null check (status in ('pending', 'approved', 'rejected')),
    granted_by    varchar(16)    not null references employee (id),
    granted_on    date           not null,
    decided_by    varchar(16)    references employee (id),
    decided_on    date,
    decision_note varchar(300),
    check (status <> 'rejected' or decision_note is not null)
);
create index allowance_grant_employee on allowance_grant (employee_id);
