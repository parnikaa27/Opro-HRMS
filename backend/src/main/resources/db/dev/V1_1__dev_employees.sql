-- Development only: the same people as the frontend's mock, so both backends feel the same.
-- Loaded through the dev profile's extra Flyway location, never in production.
insert into employee (id, full_name, designation, department, email, phone, joined_on, blood_group, nationality, work_location,
                      employment_type, manager_id, is_hr, emergency_name, emergency_relation, emergency_phone)
values
    ('OPR-0001', 'Rajesh Sharma', 'Director of Operations', 'Operations', 'rajesh.sharma@opro.mv', '+960 777 1001', '2015-03-01', 'O+', 'Indian', 'Malé office', 'Full-time', null, false, 'Meera Sharma', 'Spouse', '+960 777 2001'),
    ('OPR-0002', 'Ananya Iyer', 'HR Manager', 'People & Culture', 'ananya.iyer@opro.mv', '+960 777 1002', '2016-01-10', 'A+', 'Indian', 'Malé office', 'Full-time', 'OPR-0001', true, 'Arvind Iyer', 'Husband', '+960 777 2002'),
    ('OPR-0004', 'Vikram Singh', 'Operations Manager', 'Operations', 'vikram.singh@opro.mv', '+960 777 1004', '2018-07-15', 'B+', 'Indian', 'Malé office', 'Full-time', 'OPR-0001', false, 'Pooja Singh', 'Sister', '+960 777 2004'),
    ('OPR-0011', 'Sneha Kulkarni', 'Operations Executive', 'Operations', 'sneha.kulkarni@opro.mv', '+960 777 1011', '2021-02-01', 'A+', 'Maldivian', 'Malé office', 'Full-time', 'OPR-0004', false, 'Amit Kulkarni', 'Father', '+960 777 2011'),
    ('OPR-0015', 'Priya Nair', 'Procurement Officer', 'Operations', 'priya.nair@opro.mv', '+960 777 1015', '2022-08-14', 'AB+', 'Indian', 'Malé office', 'Full-time', 'OPR-0004', false, 'Ravi Nair', 'Brother', '+91 98470 12015'),
    ('OPR-0018', 'Arjun Reddy', 'Site Engineer', 'Operations', 'arjun.reddy@opro.mv', '+960 777 1018', '2023-12-20', 'O-', 'Indian', 'Hulhumalé site', 'Contract', 'OPR-0004', false, 'Lakshmi Reddy', 'Spouse', '+91 98450 21018'),
    ('OPR-0021', 'Rohit Verma', 'Logistics Coordinator', 'Operations', 'rohit.verma@opro.mv', '+960 777 1021', '2020-11-02', 'B-', 'Indian', 'Malé office', 'Full-time', 'OPR-0004', false, 'Sunita Verma', 'Mother', '+91 98450 21021'),
    ('OPR-0023', 'Karan Mehta', 'Customer Service Lead', 'Operations', 'karan.mehta@opro.mv', '+960 777 1023', '2019-05-05', 'A-', 'Maldivian', 'Malé office', 'Full-time', 'OPR-0004', false, 'Neha Mehta', 'Spouse', '+960 777 2023'),
    ('OPR-0027', 'Kavya Menon', 'Operations Analyst', 'Operations', 'kavya.menon@opro.mv', '+960 777 1027', '2024-03-30', 'O+', 'Indian', 'Malé office', 'Full-time', 'OPR-0004', false, 'Suresh Menon', 'Father', '+91 98450 21027');

insert into visa (employee_id, work_permit_number, visa_number, passport_last4, passport_expiry, visa_issued_on, visa_expiry)
values
    ('OPR-0001', 'WP-2015-010231', 'MV-EV-310455', '5512', '2032-04-18', '2025-02-20', '2028-02-19'),
    ('OPR-0002', 'WP-2016-020417', 'MV-EV-318820', '6603', '2031-09-09', '2025-06-01', '2028-05-31'),
    ('OPR-0004', 'WP-2018-044902', 'MV-EV-402117', '2290', '2030-12-12', '2025-09-10', '2028-09-09'),
    ('OPR-0015', 'WP-2022-118344', 'MV-EV-551902', '4821', '2031-06-30', '2025-08-15', '2027-08-14'),
    ('OPR-0018', 'WP-2023-204117', 'MV-EV-602388', '7730', '2028-02-11', '2024-12-21', '2026-12-20'),
    ('OPR-0021', 'WP-2020-087215', 'MV-EV-489150', '1196', '2029-09-04', '2024-11-03', '2026-11-02'),
    ('OPR-0027', 'WP-2024-231560', 'MV-EV-640071', '3058', '2027-01-10', '2025-03-31', '2027-03-30');
