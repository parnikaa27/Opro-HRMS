-- Onboarding. HR keeps the list of tasks: who does each (HR, the HOD or the joiner) and when it's due, in days from
-- the joining date (negative is before). Every new joiner gets a copy with real dates.
create table onboarding_task (
    id          varchar(16)  primary key,
    name        varchar(120) not null,
    owner       varchar(6)   not null check (owner in ('hr', 'hod', 'joiner')),
    due_in_days integer      not null check (due_in_days between -90 and 90),
    sort_order  integer      not null
);
insert into onboarding_task (id, name, owner, due_in_days, sort_order) values
    ('OT-1', 'Contract signed and on file', 'hr', -7, 1),
    ('OT-2', 'Photo taken and ID card printed', 'hr', 0, 2),
    ('OT-3', 'Medical insurance in place', 'hr', 7, 3),
    ('OT-4', 'Laptop and desk ready', 'hod', -1, 4),
    ('OT-5', 'First week planned', 'hod', 0, 5),
    ('OT-6', 'Upload your documents', 'joiner', 3, 6),
    ('OT-7', 'Enter your bank details', 'joiner', 7, 7),
    ('OT-8', 'Read the HR policies', 'joiner', 7, 8);

-- One person's onboarding: their first day, a buddy the HOD picks, and when everything was done.
create table onboarding (
    employee_id       varchar(16)  primary key references employee (id),
    starts_on         date         not null,
    first_day_time    varchar(5),
    first_day_place   varchar(120),
    first_day_contact varchar(120),
    buddy_id          varchar(16)  references employee (id),
    completed_on      date
);

-- Their copy of each task, with its own due date. Ticked by whoever owns it.
create table onboarding_item (
    id          varchar(16)  primary key,
    employee_id varchar(16)  not null references onboarding (employee_id),
    name        varchar(120) not null,
    owner       varchar(6)   not null check (owner in ('hr', 'hod', 'joiner')),
    due_on      date         not null,
    sort_order  integer      not null,
    done_on     date,
    done_by     varchar(16)  references employee (id)
);
create index onboarding_item_employee on onboarding_item (employee_id);
