package mv.opro.hrms.employee;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Who is at Opro today and what they can do. Roles are worked out, not stored.
@Service
@Transactional(readOnly = true)
public class People {

    private final EmployeeRepository employees;
    private final Clock clock;

    People(EmployeeRepository employees, Clock clock) {
        this.employees = employees;
        this.clock = clock;
    }

    public LocalDate today() {
        return LocalDate.now(clock);
    }

    public List<Employee> active() {
        return employees.findActiveOn(today());
    }

    public Optional<Employee> findActive(String id) {
        return employees.findById(id).filter(employee -> employee.isActiveOn(today()));
    }

    // Manager access follows reporting lines, so moving someone moves the access with them.
    public List<Role> rolesOf(Employee employee) {
        List<Role> roles = new ArrayList<>(List.of(Role.EMPLOYEE));
        if (employees.hasActiveReports(employee.getId(), today())) {
            roles.add(Role.MANAGER);
        }
        if (employee.isHr()) {
            roles.add(Role.HR);
        }
        return List.copyOf(roles);
    }
}
