-- Staff punch from the portal now, from an office or from home. The fingerprint devices are gone; their punches stay as history.
alter table punch drop constraint punch_source_check;
alter table punch add constraint punch_source_check check (source in ('device', 'manual', 'app'));
alter table punch add column work_mode varchar(6) check (work_mode in ('office', 'home'));
-- For an office punch: the office it passed at and how far away the phone was. Coordinates are never kept.
alter table punch add column office varchar(60);
alter table punch add column distance_metres integer check (distance_metres >= 0);

alter table device drop column is_online;
alter table device drop column last_sync_at;

-- A day worked from home. It counts straight away; the manager approves it after. Declined, the day counts as absent.
create table home_day (
    id            varchar(16)  primary key,
    employee_id   varchar(16)  not null references employee (id),
    work_date     date         not null,
    status        varchar(10)  not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    decided_by    varchar(16)  references employee (id),
    decided_on    date,
    decision_note varchar(300),
    unique (employee_id, work_date)
);
create index home_day_status on home_day (status, work_date);

alter table notification drop constraint notification_kind_check;
alter table notification add constraint notification_kind_check
    check (kind in ('approval', 'leave', 'visa', 'correction', 'holiday', 'announcement', 'record', 'schedule', 'home'));
