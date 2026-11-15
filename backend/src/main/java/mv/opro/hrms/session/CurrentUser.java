package mv.opro.hrms.session;

import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

// The signed in employee, loaded fresh on every request so a leaving date or a new reporting line applies at once.
@Component
public class CurrentUser {

    private final People people;

    CurrentUser(People people) {
        this.people = people;
    }

    public Employee get() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String id = authentication == null ? null : authentication.getName();
        return people.findActive(id == null ? "" : id).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Please sign in"));
    }
}
