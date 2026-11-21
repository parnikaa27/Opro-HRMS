-- Development only: Arjun's goals are approved and he has written his self review. Rohit has goals waiting for Vikram.
update appraisal_form
set accomplishments = 'Handed over phase 1 of the Hulhumalé site two weeks early.',
    strengths = 'Keeping subcontractors on schedule.',
    learning = 'A site safety course in Malé.',
    certifications = 'NEBOSH International General Certificate by June.',
    self_reviewed_on = '2026-11-11'
where employee_id = 'OPR-0018' and cycle_id = 'AY-2026';

insert into goal (id, cycle_id, employee_id, title, measure, weight, sort_order) values
    ('GL-5', 'AY-2026', 'OPR-0021', 'Cut freight delays', 'Nine in ten shipments cleared within 3 days', 70, 0),
    ('GL-6', 'AY-2026', 'OPR-0021', 'Tidy the warehouse records', 'Monthly stock count matches the system', 30, 1);
insert into appraisal_form (id, cycle_id, employee_id, goals_status, goals_submitted_on) values
    ('AF-ROHIT', 'AY-2026', 'OPR-0021', 'submitted', '2026-11-11');
