package mv.opro.hrms.team;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

// The only gate to team data: a manager reaches their own active direct reports and nobody else.
// The frontend hides the team view from non managers, but this is what actually protects the data.
@Component
class TeamAccess {

    private final People people;

    TeamAccess(People people) {
        this.people = people;
    }

    List<Employee> reportsOf(Employee manager) {
        List<Employee> reports = people.reportsOf(manager.getId());
        if (reports.isEmpty()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Managers only");
        }
        return reports;
    }

    Set<String> reportIdsOf(Employee manager) {
        return reportsOf(manager).stream().map(Employee::getId).collect(Collectors.toUnmodifiableSet());
    }

    Employee report(Employee manager, String id) {
        return reportsOf(manager).stream()
                .filter(report -> report.getId().equals(id))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not one of your reports"));
    }
}
