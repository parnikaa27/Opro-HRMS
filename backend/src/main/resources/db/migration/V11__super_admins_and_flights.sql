-- Super admins see the whole company, read only, and need nobody's approval for their own requests.
alter table employee add column is_super_admin boolean not null default false;

-- Flight claims no longer wait for HR. Anything still waiting counts as approved.
update flight_claim set status = 'approved', decided_on = raised_on where status = 'pending';
