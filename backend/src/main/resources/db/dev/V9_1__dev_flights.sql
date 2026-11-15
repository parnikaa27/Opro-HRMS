-- Development only: flight allowances for the expatriates, one approved claim and one waiting for HR.
insert into flight_allowance (employee_id, allowance_year, amount_usd, set_by, set_on)
values
    ('OPR-0015', 2026, 900, 'OPR-0002', '2026-01-05'),
    ('OPR-0018', 2026, 1200, 'OPR-0002', '2026-01-05'),
    ('OPR-0021', 2026, 1000, 'OPR-0002', '2026-01-05'),
    ('OPR-0027', 2026, 1500, 'OPR-0002', '2026-01-05');

insert into flight_claim (id, employee_id, flight_date, route, amount, currency, amount_usd, status, raised_on, decided_by, decided_on)
values
    ('FC-1', 'OPR-0018', '2026-04-10', 'Malé to Colombo and back', 6168.00, 'MVR', 400.00, 'approved', '2026-04-12', 'OPR-0002', '2026-04-13'),
    ('FC-2', 'OPR-0015', '2026-11-02', 'Malé to Kochi and back', 26400.00, 'INR', 300.00, 'pending', '2026-11-10', null, null);
