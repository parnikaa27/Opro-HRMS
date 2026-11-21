-- Development only: medical insurance is kept on the record HR keeps, so the placeholder "Health insurance" document goes.
create temporary table gone_file as
select file_id from document_file join employee_document on employee_document.id = document_file.document_id
where employee_document.type_code = 'health-insurance';
delete from employee_document where type_code = 'health-insurance';
delete from stored_file where id in (select file_id from gone_file);
delete from document_type where code = 'health-insurance';
drop table gone_file;
