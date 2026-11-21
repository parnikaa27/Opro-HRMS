-- Development only: start dates for the documents already on file, and one document HR asks a single person for.
update employee_document
set issued_on = case when expires_on is not null then (expires_on - interval '5 years')::date else coalesce(updated_on, date '2026-01-01') end;

insert into document_type (code, name, uploaded_by, has_expiry, for_expatriates_only, sort_order, is_for_everyone)
values ('marriage-certificate', 'Marriage certificate', 'employee', false, false, 7, false);
insert into document_type_person (type_code, employee_id) values ('marriage-certificate', 'OPR-0015');

-- Passports need more warning than most.
update document_type set remind_days_before = 60 where code = 'passport-copy';
