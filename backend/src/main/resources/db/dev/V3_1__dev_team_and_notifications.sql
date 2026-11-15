-- Development only: the mock's notifications and company events.

insert into company_event (id, event_date, name)
values
    ('EV-1', '2026-10-01', 'Office social'),
    ('EV-2', '2026-10-14', 'Team review'),
    ('EV-3', '2026-11-19', 'Team review'),
    ('EV-4', '2026-12-03', 'Office social'),
    ('EV-5', '2026-12-17', 'Year end dinner'),
    ('EV-6', '2027-01-14', 'Town hall');

insert into notification (employee_id, kind, text, created_on, is_read)
values
    ('OPR-0004', 'approval', 'Rohit Verma asked for half a day of family responsibility leave on 18 November', '2026-11-12', false),
    ('OPR-0004', 'approval', 'Priya Nair asked for 8 days of annual leave from 20 December', '2026-11-11', false),
    ('OPR-0004', 'visa', 'Rohit Verma''s visa expired on 2 November', '2026-11-03', true),
    ('OPR-0027', 'leave', 'Your leave on 26 November was not approved', '2026-11-07', false),
    ('OPR-0027', 'visa', 'Your passport expires on 10 January 2027. Start the renewal now', '2026-11-11', false),
    ('OPR-0018', 'visa', 'Your visa expires on 20 December. Send your documents to HR', '2026-10-21', false),
    ('OPR-0018', 'correction', 'Your punch correction for 5 November was approved', '2026-11-05', true);
