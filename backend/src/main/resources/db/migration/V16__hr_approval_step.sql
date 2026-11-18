-- HR can ask to approve after the HOD: per leave type, and once each for punch fixes, home days, comp off and overtime.
-- A request the HOD approved that waits for HR stays pending, with who approved it at the HOD step.
alter table leave_type add column needs_hr_approval boolean not null default false;

create table approval_rule (
    kind       varchar(10) primary key check (kind in ('correction', 'home-day', 'comp-off', 'overtime')),
    needs_hr   boolean     not null default false
);
insert into approval_rule (kind) values ('correction'), ('home-day'), ('comp-off'), ('overtime');

alter table leave_request add column hod_approved_by varchar(16) references employee (id), add column hod_approved_on date;
alter table correction_request add column hod_approved_by varchar(16) references employee (id), add column hod_approved_on date;
alter table home_day add column hod_approved_by varchar(16) references employee (id), add column hod_approved_on date;
alter table comp_off_claim add column hod_approved_by varchar(16) references employee (id), add column hod_approved_on date;
alter table overtime_claim add column hod_approved_by varchar(16) references employee (id), add column hod_approved_on date;
