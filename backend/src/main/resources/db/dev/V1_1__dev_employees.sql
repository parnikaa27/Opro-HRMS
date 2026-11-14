-- Development only: the same people as the frontend's mock, so both backends feel the same.
-- Loaded through the dev profile's extra Flyway location, never in production.
insert into employee (id, full_name, designation, department, email, phone, joined_on, blood_group, nationality, work_location,
                      employment_type, manager_id, is_hr, emergency_name, emergency_relation, emergency_phone)
values
    ('OPR-0001', 'Hassan Waheed', 'Director of Operations', 'Operations', 'hassan.waheed@opro.mv', '+960 777 1001', '2015-03-01', 'O+', 'Maldivian', 'Malé office', 'Full-time', null, false, 'Aminath Hassan', 'Spouse', '+960 777 2001'),
    ('OPR-0002', 'Aishath Shifa', 'HR Manager', 'People & Culture', 'aishath.shifa@opro.mv', '+960 777 1002', '2016-01-10', 'A+', 'Maldivian', 'Malé office', 'Full-time', 'OPR-0001', true, 'Hussain Shifa', 'Husband', '+960 777 2002'),
    ('OPR-0004', 'Ibrahim Rasheed', 'Operations Manager', 'Operations', 'ibrahim.rasheed@opro.mv', '+960 777 1004', '2018-07-15', 'B+', 'Maldivian', 'Malé office', 'Full-time', 'OPR-0001', false, 'Fathimath Rasheed', 'Sister', '+960 777 2004'),
    ('OPR-0011', 'Mariyam Nisha', 'Operations Executive', 'Operations', 'mariyam.nisha@opro.mv', '+960 777 1011', '2021-02-01', 'A+', 'Maldivian', 'Malé office', 'Full-time', 'OPR-0004', false, 'Ali Shareef', 'Father', '+960 777 2011'),
    ('OPR-0015', 'Priya Nair', 'Procurement Officer', 'Operations', 'priya.nair@opro.mv', '+960 777 1015', '2022-08-14', 'AB+', 'Indian', 'Malé office', 'Full-time', 'OPR-0004', false, 'Ravi Nair', 'Brother', '+91 98470 12015'),
    ('OPR-0018', 'Kasun Perera', 'Site Engineer', 'Operations', 'kasun.perera@opro.mv', '+960 777 1018', '2023-12-20', 'O-', 'Sri Lankan', 'Hulhumalé site', 'Contract', 'OPR-0004', false, 'Dilani Perera', 'Spouse', '+94 77 120 1018'),
    ('OPR-0021', 'Rahim Uddin', 'Logistics Coordinator', 'Operations', 'rahim.uddin@opro.mv', '+960 777 1021', '2020-11-02', 'B-', 'Bangladeshi', 'Malé office', 'Full-time', 'OPR-0004', false, 'Nasima Begum', 'Mother', '+880 1711 021021'),
    ('OPR-0023', 'Ahmed Zahir', 'Customer Service Lead', 'Operations', 'ahmed.zahir@opro.mv', '+960 777 1023', '2019-05-05', 'A-', 'Maldivian', 'Malé office', 'Full-time', 'OPR-0004', false, 'Shiuna Zahir', 'Spouse', '+960 777 2023'),
    ('OPR-0027', 'Grace Mendoza', 'Operations Analyst', 'Operations', 'grace.mendoza@opro.mv', '+960 777 1027', '2024-03-30', 'O+', 'Filipino', 'Malé office', 'Full-time', 'OPR-0004', false, 'Ramon Mendoza', 'Father', '+63 917 102 7027');

insert into visa (employee_id, work_permit_number, visa_number, passport_last4, passport_expiry, visa_issued_on, visa_expiry)
values
    ('OPR-0015', 'WP-2022-118344', 'MV-EV-551902', '4821', '2031-06-30', '2025-08-15', '2027-08-14'),
    ('OPR-0018', 'WP-2023-204117', 'MV-EV-602388', '7730', '2028-02-11', '2024-12-21', '2026-12-20'),
    ('OPR-0021', 'WP-2020-087215', 'MV-EV-489150', '1196', '2029-09-04', '2024-11-03', '2026-11-02'),
    ('OPR-0027', 'WP-2024-231560', 'MV-EV-640071', '3058', '2027-01-10', '2025-03-31', '2027-03-30');
