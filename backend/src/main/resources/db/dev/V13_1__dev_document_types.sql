-- Development only: placeholders until HR shares the real list. Employees upload their passport and certificates;
-- HR checks them. The contract, visa copy and insurance are HR's to add.
update document_type set uploaded_by = 'employee', has_expiry = true, for_expatriates_only = true where code = 'passport-copy';
update document_type set has_expiry = true, for_expatriates_only = true where code = 'visa-copy';
update document_type set uploaded_by = 'employee' where code = 'national-id';
insert into document_type (code, name, uploaded_by, has_expiry, for_expatriates_only, sort_order)
values ('educational-certificates', 'Educational certificates', 'employee', false, false, 6);
