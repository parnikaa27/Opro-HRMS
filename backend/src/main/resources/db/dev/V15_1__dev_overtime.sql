-- Two working days Vikram's reports stayed late, waiting for him. Fixed punches, so the overtime is the same every run.
insert into punch (employee_id, punched_at, source, work_mode, office, distance_metres) values
    ('OPR-0018', '2026-11-09T08:50:00+05:00', 'app', 'office', 'Hulhumalé site', 40),
    ('OPR-0018', '2026-11-09T18:20:00+05:00', 'app', 'office', 'Hulhumalé site', 35),
    ('OPR-0021', '2026-11-08T08:58:00+05:00', 'app', 'office', 'Malé office', 60),
    ('OPR-0021', '2026-11-08T18:05:00+05:00', 'app', 'office', 'Malé office', 55);

insert into overtime_claim (id, employee_id, work_date) values
    ('OT-1', 'OPR-0018', '2026-11-09'),
    ('OT-2', 'OPR-0021', '2026-11-08');
