-- The goals and the four other sections go to the HOD, then HR, as one plan. The form's status covers all of it.
alter table appraisal_form rename column goals_status to status;
alter table appraisal_form rename column goals_submitted_on to submitted_on;
alter table appraisal_form rename column goals_decided_by to decided_by;
alter table appraisal_form rename column goals_decided_on to decided_on;
alter table appraisal_form rename column goals_note to note;

-- Each section holds as many entries as the person adds. A certification has a target date; a strength is a title only.
create table performance_entry (
    id           varchar(16)   primary key,
    cycle_id     varchar(16)   not null references appraisal_cycle (id),
    employee_id  varchar(16)   not null references employee (id),
    section      varchar(16)   not null check (section in ('certification', 'learning', 'accomplishment', 'strength')),
    title        varchar(120)  not null,
    details      varchar(1000),
    target_on    date,
    sort_order   int           not null,
    check (target_on is null or section = 'certification')
);
create index performance_entry_person on performance_entry (cycle_id, employee_id);

-- What people wrote as one block of text becomes the first entry of its section.
insert into performance_entry (id, cycle_id, employee_id, section, title, details, sort_order)
select 'PE-' || substr(md5(form.id || part.section), 1, 8), form.cycle_id, form.employee_id, part.section,
       left(part.text, 120), case when length(part.text) > 120 then part.text end, 0
from appraisal_form form
cross join lateral (values ('accomplishment', form.accomplishments), ('strength', form.strengths), ('learning', form.learning),
                           ('certification', form.certifications)) as part (section, text)
where part.text is not null;

alter table appraisal_form drop column accomplishments, drop column strengths, drop column learning, drop column certifications,
    drop column self_reviewed_on;
