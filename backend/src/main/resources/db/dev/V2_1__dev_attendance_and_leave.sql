-- Development only: the mock's holidays, schedule, devices, leave and punch fix requests, so both backends match.

insert into holiday (id, holiday_date, name, is_tentative)
values
    ('HD-1', '2026-01-01', 'New Year''s Day', false),
    ('HD-2', '2026-02-18', 'First day of Ramadan', true),
    ('HD-3', '2026-03-20', 'Eid al Fitr', true),
    ('HD-4', '2026-03-21', 'Eid al Fitr holiday', true),
    ('HD-5', '2026-03-22', 'Eid al Fitr holiday', true),
    ('HD-6', '2026-05-26', 'Hajj Day', true),
    ('HD-7', '2026-05-27', 'Eid al Adha', true),
    ('HD-8', '2026-05-28', 'Eid al Adha holiday', true),
    ('HD-9', '2026-05-29', 'Eid al Adha holiday', true),
    ('HD-10', '2026-05-30', 'Eid al Adha holiday', true),
    ('HD-11', '2026-06-16', 'Islamic New Year', true),
    ('HD-12', '2026-07-26', 'Independence Day', false),
    ('HD-13', '2026-08-14', 'National Day', true),
    ('HD-14', '2026-08-25', 'Mawlid al Nabi', true),
    ('HD-15', '2026-09-12', 'The Day Maldives Embraced Islam', true),
    ('HD-16', '2026-11-03', 'Victory Day', false),
    ('HD-17', '2026-11-11', 'Republic Day', false),
    ('HD-18', '2027-01-01', 'New Year''s Day', false),
    ('HD-19', '2027-02-08', 'First day of Ramadan', true),
    ('HD-20', '2027-03-10', 'Eid al Fitr', true),
    ('HD-21', '2027-03-11', 'Eid al Fitr holiday', true),
    ('HD-22', '2027-03-12', 'Eid al Fitr holiday', true),
    ('HD-23', '2027-05-16', 'Hajj Day', true),
    ('HD-24', '2027-05-17', 'Eid al Adha', true),
    ('HD-25', '2027-05-18', 'Eid al Adha holiday', true),
    ('HD-26', '2027-05-19', 'Eid al Adha holiday', true),
    ('HD-27', '2027-05-20', 'Eid al Adha holiday', true),
    ('HD-28', '2027-06-06', 'Islamic New Year', true),
    ('HD-29', '2027-07-26', 'Independence Day', false),
    ('HD-30', '2027-08-04', 'National Day', true),
    ('HD-31', '2027-08-15', 'Mawlid al Nabi', true),
    ('HD-32', '2027-09-02', 'The Day Maldives Embraced Islam', true),
    ('HD-33', '2027-11-03', 'Victory Day', false),
    ('HD-34', '2027-11-11', 'Republic Day', false);

insert into work_schedule (id, effective_from, shift_start, shift_end, grace_minutes, half_day_minutes, ramadan_start, ramadan_end, reason, set_by, set_on)
values
    ('WS-1', '2024-01-01', '09:00', '17:00', 15, 240, '09:00', '14:00', 'Company hours since 2024', 'OPR-0002', '2023-12-10');

insert into device (id, name, location, is_online)
values
    ('OPR-MLE-01', 'Front desk', 'Malé office', true),
    ('OPR-HMH-01', 'Site gate', 'Hulhumalé site', true);

insert into leave_type (code, name, allows_half_day, is_unlimited, default_entitlement, document_required_after_days, sort_order)
values
    ('annual', 'Annual leave', true, false, 30, null, 1),
    ('sick', 'Sick leave', true, false, 30, 2, 2),
    ('family', 'Family responsibility leave', true, false, 10, null, 3),
    ('maternity', 'Maternity leave', false, false, 60, null, 4),
    ('paternity', 'Paternity leave', false, false, 3, null, 5),
    ('unpaid', 'Unpaid leave', true, true, null, null, 6);

-- taken_before is what the mock shows as taken minus the approved requests below, so the totals match.
insert into leave_entitlement (employee_id, type, leave_year, entitled, taken_before)
values
    ('OPR-0001', 'annual', 2026, 30, 14),
    ('OPR-0001', 'sick', 2026, 30, 2),
    ('OPR-0001', 'family', 2026, 10, 0),
    ('OPR-0004', 'annual', 2026, 30, 11),
    ('OPR-0004', 'sick', 2026, 30, 3),
    ('OPR-0004', 'family', 2026, 10, 1),
    ('OPR-0011', 'annual', 2026, 30, 15),
    ('OPR-0011', 'sick', 2026, 30, 3),
    ('OPR-0011', 'family', 2026, 10, 2),
    ('OPR-0015', 'annual', 2026, 30, 9),
    ('OPR-0015', 'sick', 2026, 30, 1),
    ('OPR-0015', 'family', 2026, 10, 0),
    ('OPR-0018', 'annual', 2026, 30, 18),
    ('OPR-0018', 'sick', 2026, 30, 5),
    ('OPR-0018', 'family', 2026, 10, 3),
    ('OPR-0018', 'paternity', 2026, 3, 0),
    ('OPR-0021', 'annual', 2026, 30, 22),
    ('OPR-0021', 'sick', 2026, 30, 2),
    ('OPR-0021', 'family', 2026, 10, 4),
    ('OPR-0023', 'annual', 2026, 30, 16),
    ('OPR-0023', 'sick', 2026, 30, 0),
    ('OPR-0023', 'family', 2026, 10, 1),
    ('OPR-0027', 'annual', 2026, 30, 6),
    ('OPR-0027', 'sick', 2026, 30, 1),
    ('OPR-0027', 'family', 2026, 10, 0),
    ('OPR-0002', 'annual', 2026, 30, 8),
    ('OPR-0002', 'sick', 2026, 30, 1),
    ('OPR-0002', 'family', 2026, 10, 0);

insert into leave_request (id, employee_id, type, from_date, to_date, half_day, days, reason, status, applied_on, decided_by, decided_on, decision_note)
values
    ('LR-1042', 'OPR-0011', 'annual', '2026-11-22', '2026-11-24', null, 3, 'Family trip to Addu', 'pending', '2026-11-10', null, null, null),
    ('LR-1043', 'OPR-0015', 'annual', '2026-12-20', '2026-12-31', null, 8, 'Going home to Kochi for the holidays', 'pending', '2026-11-11', null, null, null),
    ('LR-1044', 'OPR-0021', 'family', '2026-11-18', '2026-11-18', 'first', 0.5, 'Parent meeting at my son''s school', 'pending', '2026-11-12', null, null, null),
    ('LR-1045', 'OPR-0004', 'annual', '2026-12-06', '2026-12-10', null, 5, 'Umrah', 'pending', '2026-11-12', null, null, null),
    ('LR-1031', 'OPR-0018', 'sick', '2026-11-04', '2026-11-04', null, 1, 'Fever', 'approved', '2026-11-04', 'OPR-0004', '2026-11-04', null),
    ('LR-1027', 'OPR-0023', 'annual', '2026-10-12', '2026-10-15', null, 4, 'Brother''s wedding', 'approved', '2026-09-28', 'OPR-0004', '2026-09-29', null),
    ('LR-1029', 'OPR-0011', 'sick', '2026-10-21', '2026-10-21', null, 1, 'Migraine', 'approved', '2026-10-21', 'OPR-0004', '2026-10-21', null),
    ('LR-1036', 'OPR-0027', 'annual', '2026-11-26', '2026-11-26', null, 1, 'Long weekend', 'rejected', '2026-11-06', 'OPR-0004', '2026-11-07', 'That''s the year end audit week. Could you take it in December instead?'),
    ('LR-1033', 'OPR-0004', 'sick', '2026-11-02', '2026-11-02', null, 1, 'Dentist', 'cancelled', '2026-10-30', null, null, null);

insert into correction_request (id, employee_id, punch_date, kind, requested_time, reason, status, raised_on, decided_by, decided_on)
values
    ('AC-301', 'OPR-0021', '2026-11-10', 'missed-out', '17:20', 'Device was offline when I left', 'pending', '2026-11-11', null, null),
    ('AC-298', 'OPR-0018', '2026-11-05', 'missed-in', '08:55', 'Started at the Hulhumalé site, no device there', 'approved', '2026-11-05', 'OPR-0004', '2026-11-05');
