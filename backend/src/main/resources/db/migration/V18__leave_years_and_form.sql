-- Leave years run from each person's joining anniversary, not January. leave_year is the calendar year a leave year starts in.
-- A request still stays inside one leave year, which the server checks, so the New Year rule goes.
do $$
declare
    rule text;
begin
    select conname into rule from pg_constraint
    where conrelid = 'leave_request'::regclass and pg_get_constraintdef(oid) ilike '%year from from_date%';
    execute format('alter table leave_request drop constraint %I', rule);
end $$;

-- Scheduled leave is asked for this many days ahead (annual leave: a month). Null means no notice is needed.
alter table leave_type add column notice_days integer check (notice_days between 1 and 365);

-- The paper form: an initial, amended or extended application, and the flight entitlement and salary advance ticks.
alter table leave_request
    add column kind                    varchar(10) not null default 'initial' check (kind in ('initial', 'amended', 'extended')),
    add column related_request_id      varchar(16) references leave_request (id),
    add column uses_flight_entitlement boolean     not null default false,
    add column wants_salary_advance    boolean     not null default false,
    add constraint leave_request_related check ((kind = 'initial') = (related_request_id is null));
