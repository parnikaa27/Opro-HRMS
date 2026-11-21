-- What HR collects back before someone leaves. HR keeps the list in Policies; these four are where Opro starts.
create table exit_item (
    id         varchar(16) primary key,
    name       varchar(60) not null,
    sort_order integer     not null
);
create unique index exit_item_name on exit_item (lower(name));
insert into exit_item (id, name, sort_order)
values ('EI-1', 'Laptop', 1), ('EI-2', 'ID card', 2), ('EI-3', 'Bus travel card', 3), ('EI-4', 'Accommodation keys', 4);

-- Someone resigning: the date they put it in, why, and the last day they ask for. Their HOD approves, then HR, who sets
-- the exit date. hod_approved_on without hod_approved_by means there was no HOD to ask (a super admin).
create table resignation (
    id              varchar(16)  primary key,
    employee_id     varchar(16)  not null references employee (id),
    submitted_on    date         not null,
    reason          varchar(500) not null,
    release_on      date         not null,
    status          varchar(10)  not null check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
    hod_approved_by varchar(16)  references employee (id),
    hod_approved_on date,
    decided_by      varchar(16)  references employee (id),
    decided_on      date,
    decision_note   varchar(300),
    exit_on         date,
    check (release_on > submitted_on),
    check (status <> 'approved' or exit_on is not null),
    check (status <> 'rejected' or decision_note is not null)
);
-- One open resignation per person at a time.
create unique index resignation_open on resignation (employee_id) where status in ('pending', 'approved');

-- Each item ticked off as it comes back, or marked as never given. Leaving waits until every item is ticked.
create table exit_return (
    resignation_id varchar(16) not null references resignation (id),
    item_id        varchar(16) not null references exit_item (id) on delete cascade,
    outcome        varchar(10) not null check (outcome in ('returned', 'not-given')),
    ticked_by      varchar(16) not null references employee (id),
    ticked_on      date        not null,
    primary key (resignation_id, item_id)
);
