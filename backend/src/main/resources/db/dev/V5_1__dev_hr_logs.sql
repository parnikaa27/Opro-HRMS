-- Development only: the mock's one balance adjustment, and the entitlement that includes it, so the log adds up.
insert into balance_adjustment (id, employee_id, type, leave_year, days, reason, made_by, made_on)
values ('BA-1', 'OPR-0021', 'annual', 2026, 2, 'Carried forward from 2025, approved by the director', 'OPR-0002', '2026-01-05');

update leave_entitlement set entitled = entitled + 2 where employee_id = 'OPR-0021' and type = 'annual' and leave_year = 2026;
