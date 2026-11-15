-- Which expiry reminders have gone out, so each one is sent once even if the server was down when it was due.
-- A renewal changes expires_on, which starts the reminders again for the new date.
create table visa_reminder (
    id          bigint      generated always as identity primary key,
    employee_id varchar(16) not null references employee (id),
    document    varchar(8)  not null check (document in ('visa', 'passport')),
    expires_on  date        not null,
    notice_days integer     not null,
    sent_on     date        not null,
    unique (employee_id, document, expires_on, notice_days)
);
