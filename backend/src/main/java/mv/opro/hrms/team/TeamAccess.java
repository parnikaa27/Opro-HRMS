package mv.opro.hrms.team;

import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

// The only gate to team data: a manager reaches their own active direct reports and nobody else,
// and a super admin reaches everyone. The frontend hides these views, but this is what actually protects the data.
@Component
public class TeamAccess {

    private final People people;

    TeamAccess(People people) {
        this.people = people;
    }

    public List<Employee> reportsOf(Employee manager) {
        List<Employee> reports = people.reportsOf(manager.getId());
        if (reports.isEmpty()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Managers only");
        }
        return reports;
    }

    public List<Employee> everyoneFor(Employee reader) {
        if (!reader.isSuperAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Super admins only");
        }
        return people.active();
    }
}
