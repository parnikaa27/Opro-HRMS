-- Every manual change to a balance, with who, when and why. The entitlement itself already includes it.
create table balance_adjustment (
    id         varchar(16)   primary key,
    employee_id varchar(16)  not null references employee (id),
    type       varchar(20)   not null references leave_type (code),
    leave_year integer       not null,
    days       numeric(5, 1) not null check (days <> 0),
    reason     varchar(300)  not null,
    made_by    varchar(16)   not null references employee (id),
    made_on    date          not null
);
create index balance_adjustment_employee on balance_adjustment (employee_id, made_on desc);

-- Every punch HR adds or voids by hand, with who, when and why. Raw punches themselves never change.
create table punch_edit (
    id          varchar(16)  primary key,
    employee_id varchar(16)  not null references employee (id),
    punch_date  date         not null,
    action      varchar(4)   not null check (action in ('add', 'void')),
    punch_time  time         not null,
    reason      varchar(300) not null,
    made_by     varchar(16)  not null references employee (id),
    made_on     date         not null
);
create index punch_edit_employee on punch_edit (employee_id, punch_date);

-- Who voided a punch, next to when.
alter table punch add column voided_by varchar(16) references employee (id);
