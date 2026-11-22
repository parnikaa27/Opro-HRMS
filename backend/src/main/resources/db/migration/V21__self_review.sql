-- Each person's part of an appraisal cycle: the goals they write, on their way through their HOD and then HR, and
-- their self review. draft and rejected can be edited; submitted waits for the HOD, hod-approved for HR.
create table appraisal_form (
    id                  varchar(16)   primary key,
    cycle_id            varchar(16)   not null references appraisal_cycle (id),
    employee_id         varchar(16)   not null references employee (id),
    goals_status        varchar(12)   not null check (goals_status in ('draft', 'submitted', 'hod-approved', 'approved', 'rejected')),
    goals_submitted_on  date,
    hod_approved_by     varchar(16)   references employee (id),
    hod_approved_on     date,
    goals_decided_by    varchar(16)   references employee (id),
    goals_decided_on    date,
    goals_note          varchar(300),
    accomplishments     varchar(2000),
    strengths           varchar(2000),
    learning            varchar(2000),
    certifications      varchar(2000),
    self_reviewed_on    date,
    unique (cycle_id, employee_id),
    check (goals_status <> 'rejected' or goals_note is not null)
);

-- Goals HODs set before people wrote their own count as approved.
insert into appraisal_form (id, cycle_id, employee_id, goals_status, goals_decided_on)
select distinct 'AF-' || substr(md5(cycle_id || employee_id), 1, 8), cycle_id, employee_id, 'approved', current_date
from goal;

-- The HOD comments on the self review when appraising. The person accepts the rating.
alter table appraisal add column self_review_comment varchar(2000);
alter table appraisal rename column acknowledged_on to accepted_on;
