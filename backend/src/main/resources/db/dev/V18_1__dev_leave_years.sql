-- The dev balances were written for calendar 2026. Move each to the leave year that held 12 November 2026, the date the tests run on.
update leave_entitlement entitlement
set leave_year = case when to_char(employee.joined_on, 'MMDD') <= '1112' then 2026 else 2025 end
from employee
where employee.id = entitlement.employee_id and entitlement.leave_year = 2026;

update balance_adjustment adjustment
set leave_year = case when to_char(employee.joined_on, 'MMDD') <= '1112' then 2026 else 2025 end
from employee
where employee.id = adjustment.employee_id and adjustment.leave_year = 2026;
