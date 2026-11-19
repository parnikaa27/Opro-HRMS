-- An open appraisal cycle with a few of Vikram's team under way: Arjun has goals, Karan is appraised.
insert into appraisal_cycle (id, name, due_on, opened_by, opened_on) values
    ('AY-2026', '2026 appraisals', '2027-01-31', 'OPR-0002', '2026-11-10');

insert into goal (id, cycle_id, employee_id, title, measure, weight, sort_order, rating, comment) values
    ('GL-1', 'AY-2026', 'OPR-0018', 'Hand over phase 2 of the Hulhumalé site', 'Snag list closed by 30 November', 60, 0, null, null),
    ('GL-2', 'AY-2026', 'OPR-0018', 'Fewer site incidents', 'No lost time incidents this year', 40, 1, null, null),
    ('GL-3', 'AY-2026', 'OPR-0023', 'Faster replies to customers', 'First reply within 4 working hours, every month', 70, 0, 4, 'Under 3 hours since August.'),
    ('GL-4', 'AY-2026', 'OPR-0023', 'Train a second person on the complaints desk', 'They cover a week alone', 30, 1, 3, null);

insert into appraisal (id, cycle_id, employee_id, rating, comments, recommends_promotion, increment_percent, appraised_by, appraised_on) values
    ('AP-1', 'AY-2026', 'OPR-0023', 4, 'Karan brought reply times well under target and kept the team calm through the busy season. Next year, let''s have him lead the service review.', true, 8.0,
     'OPR-0004', '2026-11-11');
