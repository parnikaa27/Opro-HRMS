-- Performance: probation reviews, and yearly appraisal cycles HR opens, with goals the HOD sets and rates.

-- The HOD's decision before someone's probation ends. Confirming clears the person's probation date,
-- extending moves it, not confirming leaves it for HR to act on.
create table probation_review (
    id               varchar(16)  primary key,
    employee_id      varchar(16)  not null references employee (id),
    probation_ended  date         not null,
    outcome          varchar(14)  not null check (outcome in ('confirmed', 'extended', 'not-confirmed')),
    extended_to      date,
    comments         varchar(1000) not null,
    reviewed_by      varchar(16)  not null references employee (id),
    reviewed_on      date         not null,
    check ((outcome = 'extended') = (extended_to is not null))
);
create index probation_review_employee on probation_review (employee_id);

-- One cycle open at a time.
create table appraisal_cycle (
    id         varchar(16)  primary key,
    name       varchar(60)  not null,
    due_on     date         not null,
    opened_by  varchar(16)  not null references employee (id),
    opened_on  date         not null,
    closed_on  date
);
create unique index appraisal_cycle_one_open on appraisal_cycle ((closed_on is null)) where closed_on is null;

-- A person's goals in a cycle, weighted to 100. Rated when the HOD appraises them.
create table goal (
    id           varchar(16)  primary key,
    cycle_id     varchar(16)  not null references appraisal_cycle (id),
    employee_id  varchar(16)  not null references employee (id),
    title        varchar(120) not null,
    measure      varchar(300) not null,
    weight       integer      not null check (weight between 1 and 100),
    sort_order   integer      not null,
    rating       integer      check (rating between 1 and 5),
    comment      varchar(500)
);
create index goal_cycle_employee on goal (cycle_id, employee_id);

create table appraisal (
    id                    varchar(16)   primary key,
    cycle_id              varchar(16)   not null references appraisal_cycle (id),
    employee_id           varchar(16)   not null references employee (id),
    rating                integer       not null check (rating between 1 and 5),
    comments              varchar(2000) not null,
    recommends_promotion  boolean       not null,
    increment_percent     numeric(4, 1) check (increment_percent > 0 and increment_percent <= 100),
    appraised_by          varchar(16)   not null references employee (id),
    appraised_on          date          not null,
    acknowledged_on       date,
    unique (cycle_id, employee_id)
);

alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
    check (kind in ('approval', 'leave', 'visa', 'correction', 'holiday', 'announcement', 'record', 'schedule', 'home', 'flight', 'overtime',
                    'performance'));
