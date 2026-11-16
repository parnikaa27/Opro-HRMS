-- Ramadan hours aren't used at Opro. Every day follows the one schedule in force.
alter table work_schedule drop column ramadan_start, drop column ramadan_end;
