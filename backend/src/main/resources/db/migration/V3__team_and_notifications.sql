-- What lands in someone's notifications panel, written in plain words when it happens.
create table notification (
    id          bigint generated always as identity primary key,
    employee_id varchar(16)  not null references employee (id),
    kind        varchar(20)  not null check (kind in ('approval', 'leave', 'visa', 'correction', 'holiday', 'announcement', 'record', 'schedule')),
    text        varchar(500) not null,
    created_on  date         not null,
    is_read     boolean      not null default false
);
create index notification_employee on notification (employee_id, created_on desc);

-- Company dates on the calendar, like "Office social". HR manages them later.
create table company_event (
    id         varchar(16) primary key,
    event_date date        not null,
    name       varchar(60) not null
);
create index company_event_date on company_event (event_date);

-- A punch added by approving a punch fix points back at that request, so the record shows where it came from.
alter table punch add column correction_request_id varchar(16) references correction_request (id);
