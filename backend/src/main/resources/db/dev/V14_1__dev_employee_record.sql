-- Development only: the new parts of each record, so every screen and reminder has something to show.
update employee set gender = 'male', date_of_birth = '1978-06-14' where id = 'OPR-0001';
update employee set gender = 'female', date_of_birth = '1985-09-22' where id = 'OPR-0002';
update employee set gender = 'male', date_of_birth = '1983-01-30', job_category = 'Management' where id = 'OPR-0004';
update employee set gender = 'female', date_of_birth = '1996-04-18' where id = 'OPR-0011';
update employee set gender = 'female', date_of_birth = '1992-11-20', job_category = 'Administration' where id = 'OPR-0015';
update employee set gender = 'male', date_of_birth = '1996-02-29', job_category = 'Engineering', contract_ends_on = '2027-01-15' where id = 'OPR-0018';
update employee set gender = 'male', date_of_birth = '1988-07-07', job_category = 'Logistics' where id = 'OPR-0021';
update employee set gender = 'male', date_of_birth = '1990-12-03' where id = 'OPR-0023';
update employee set gender = 'female', date_of_birth = '1998-08-11', job_category = 'Administration', probation_ends_on = '2026-12-20' where id = 'OPR-0027';
update employee set job_category = 'Management' where id in ('OPR-0001', 'OPR-0002');

update visa set employment_approval_number = 'EA-' || substr(work_permit_number, 4), employment_approval_expiry = visa_expiry + 365,
    medical_due_on = visa_expiry + 120;

insert into medical_insurance (employee_id, provider, policy_number, expires_on)
values
    ('OPR-0015', 'Allied Insurance', 'AIM-552190', '2027-06-30'),
    ('OPR-0018', 'Allied Insurance', 'AIM-602388', '2027-04-30'),
    ('OPR-0021', 'Allied Insurance', 'AIM-489150', '2027-05-31'),
    ('OPR-0027', 'Allied Insurance', 'AIM-640071', '2027-03-31');

insert into bank_account (employee_id, bank_name, account_name, account_number, currency, status, submitted_on, decided_by, decided_on)
values
    ('OPR-0018', 'Bank of Maldives', 'Arjun Reddy', '7730000123456', 'MVR', 'verified', '2026-01-10', 'OPR-0002', '2026-01-11'),
    ('OPR-0015', 'Maldives Islamic Bank', 'Priya Nair', '9001234567', 'USD', 'pending', '2026-11-10', null, null);

insert into education (id, employee_id, qualification, institution, completed_year)
values
    ('ED-1', 'OPR-0018', 'BTech, Civil Engineering', 'Osmania University', 2016),
    ('ED-2', 'OPR-0027', 'BCom', 'University of Kerala', 2019);

insert into work_experience (id, employee_id, employer, role, from_date, to_date)
values ('EX-1', 'OPR-0018', 'L&T Construction', 'Site Engineer', '2016-07-01', '2023-11-30');

insert into quota_approval (id, job_category, slots, approval_number, approved_on, expires_on)
values
    ('QA-1', 'Engineering', 2, 'QT-2025-0412', '2025-12-01', '2026-12-31'),
    ('QA-2', 'Administration', 2, 'QT-2025-0413', '2025-12-01', '2027-06-30'),
    ('QA-3', 'Management', 3, 'QT-2024-0098', '2024-06-01', '2027-05-31'),
    ('QA-4', 'Logistics', 1, 'QT-2025-0414', '2025-12-01', '2027-06-30');
