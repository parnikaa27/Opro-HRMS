-- Punching at a client resort: checked against resort pins, the way an office punch is checked against offices.
alter table punch drop constraint punch_work_mode_check;
alter table punch add constraint punch_work_mode_check check (work_mode in ('office', 'home', 'resort'));

-- What a punch fix is for. A late punch and anything else need a reason; working from a resort and forgetting don't.
alter table correction_request add column category varchar(8) not null default 'forgot' check (category in ('resort', 'forgot', 'late', 'other'));
alter table correction_request alter column category drop default;
alter table correction_request alter column reason drop not null;
alter table correction_request add constraint correction_request_reason_check check (category in ('resort', 'forgot') or reason is not null);
-- A late punch is always about the punch in.
alter table correction_request add constraint correction_request_late_check check (category <> 'late' or kind = 'missed-in');
