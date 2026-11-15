-- Public holidays. Islamic dates stay tentative until HR confirms them after the moon sighting.
create table holiday (
    id           varchar(16) primary key,
    holiday_date date        not null,
    name         varchar(80) not null,
    is_tentative boolean     not null default false
);
create index holiday_date on holiday (holiday_date);

-- Shift rules as dated versions. A day is always worked out with the version in force on that date.
create table work_schedule (
    id               varchar(16)  primary key,
    effective_from   date         not null unique,
    shift_start      time         not null,
    shift_end        time         not null,
    grace_minutes    integer      not null check (grace_minutes between 0 and 60),
    half_day_minutes integer      not null check (half_day_minutes > 0),
    ramadan_start    time         not null,
    ramadan_end      time         not null,
    reason           varchar(300) not null,
    set_by           varchar(16)  not null references employee (id),
    set_on           date         not null,
    check (shift_end > shift_start),
    check (ramadan_end > ramadan_start)
);

-- Biometric devices. They report their own online state and last sync once a device is connected.
create table device (
    id           varchar(32) primary key,
    name         varchar(60) not null,
    location     varchar(60) not null,
    is_online    boolean     not null default false,
    last_sync_at timestamptz
);

-- Raw punches. Never edited: a wrong one is voided, a missing one is added by hand, so the record stays honest.
create table punch (
    id          bigint generated always as identity primary key,
    employee_id varchar(16) not null references employee (id),
    punched_at  timestamptz not null,
    device_id   varchar(32) references device (id),
    source      varchar(10) not null check (source in ('device', 'manual')),
    voided_at   timestamptz,
    unique (employee_id, punched_at)
);
create index punch_employee_time on punch (employee_id, punched_at);

-- An employee asking for a missed punch to be added.
create table correction_request (
    id             varchar(16)  primary key,
    employee_id    varchar(16)  not null references employee (id),
    punch_date     date         not null,
    kind           varchar(12)  not null check (kind in ('missed-in', 'missed-out')),
    requested_time time         not null,
    reason         varchar(300) not null,
    status         varchar(10)  not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    raised_on      date         not null,
    decided_by     varchar(16)  references employee (id),
    decided_on     date,
    decision_note  varchar(300)
);
create index correction_request_employee on correction_request (employee_id, punch_date);

create table leave_type (
    code                        varchar(20) primary key,
    name                        varchar(60) not null,
    allows_half_day             boolean     not null,
    is_unlimited                boolean     not null default false,
    default_entitlement         numeric(5, 1),
    document_required_after_days integer,
    sort_order                  integer     not null
);

-- What someone gets in a leave year. Taken and pending are always worked out from requests, never stored,
-- except leave used before Opro HRMS existed, which has nowhere else to come from.
create table leave_entitlement (
    employee_id  varchar(16)  not null references employee (id),
    type         varchar(20)  not null references leave_type (code),
    leave_year   integer      not null,
    entitled     numeric(5, 1) not null check (entitled >= 0),
    taken_before numeric(5, 1) not null default 0 check (taken_before >= 0),
    primary key (employee_id, type, leave_year)
);

create table leave_request (
    id              varchar(16)   primary key,
    employee_id     varchar(16)   not null references employee (id),
    type            varchar(20)   not null references leave_type (code),
    from_date       date          not null,
    to_date         date          not null,
    half_day        varchar(6)    check (half_day in ('first', 'second')),
    days            numeric(5, 1) not null check (days > 0),
    reason          varchar(300)  not null,
    status          varchar(10)   not null check (status in ('pending', 'approved', 'rejected', 'cancelled')),
    applied_on      date          not null,
    decided_by      varchar(16)   references employee (id),
    decided_on      date,
    decision_note   varchar(300),
    recorded_by_hr  boolean       not null default false,
    has_certificate boolean       not null default false,
    check (to_date >= from_date),
    -- Leave comes out of one year's balance, so a request never crosses New Year.
    check (extract(year from from_date) = extract(year from to_date)),
    check (half_day is null or from_date = to_date)
);
create index leave_request_employee on leave_request (employee_id, from_date);
