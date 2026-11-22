-- Development only: Kavya, the newest on Vikram's team, still onboarding with a few tasks done.
insert into onboarding (employee_id, starts_on, first_day_time, first_day_place, first_day_contact) values
    ('OPR-0027', '2026-11-01', '08:45', 'Malé office, 3rd floor reception', 'Ananya Iyer');
insert into onboarding_item (id, employee_id, name, owner, due_on, sort_order, done_on, done_by) values
    ('OI-1', 'OPR-0027', 'Contract signed and on file', 'hr', '2026-10-25', 1, '2026-10-24', 'OPR-0002'),
    ('OI-2', 'OPR-0027', 'Photo taken and ID card printed', 'hr', '2026-11-01', 2, null, null),
    ('OI-3', 'OPR-0027', 'Laptop and desk ready', 'hod', '2026-10-31', 3, '2026-10-30', 'OPR-0004'),
    ('OI-4', 'OPR-0027', 'First week planned', 'hod', '2026-11-01', 4, null, null),
    ('OI-5', 'OPR-0027', 'Upload your documents', 'joiner', '2026-11-04', 5, null, null),
    ('OI-6', 'OPR-0027', 'Read the HR policies', 'joiner', '2026-11-08', 6, null, null);
