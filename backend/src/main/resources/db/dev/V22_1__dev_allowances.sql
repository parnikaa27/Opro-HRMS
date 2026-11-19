-- Development only: a few monthly allowances, and a one-off Vikram granted Rohit that waits for HR.
insert into monthly_allowance (id, employee_id, type_code, amount, currency, starts_on, set_by, set_on) values
    ('MA-1', 'OPR-0018', 'housing', 6000, 'MVR', '2024-01-01', 'OPR-0002', '2023-12-20'),
    ('MA-2', 'OPR-0018', 'food', 1500, 'MVR', '2024-01-01', 'OPR-0002', '2023-12-20'),
    ('MA-3', 'OPR-0015', 'housing', 400, 'USD', '2022-09-01', 'OPR-0002', '2022-08-14');
insert into allowance_grant (id, employee_id, type_code, amount, currency, reason, status, granted_by, granted_on) values
    ('AG-1', 'OPR-0021', 'transport', 750, 'MVR', 'Taxis during the ferry strike', 'pending', 'OPR-0004', '2026-11-10');
