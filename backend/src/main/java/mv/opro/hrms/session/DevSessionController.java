package mv.opro.hrms.session;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.employee.Role;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// The "pick a user" sign in, for development only. Real sign in (likely SSO) replaces it, and this class
// does not exist outside the dev profile, so production has no way to sign in as someone else.
@Profile("dev")
@RestController
class DevSessionController {

    record UserChoice(String id, String fullName, String designation, List<Role> roles) {}

    record LoginRequest(@NotBlank String employeeId) {}

    private final People people;
    private final SecurityContextRepository contexts = new HttpSessionSecurityContextRepository();

    DevSessionController(People people) {
        this.people = people;
    }

    @GetMapping("/api/session/users")
    List<UserChoice> users() {
        return people.active().stream()
                .map(employee -> new UserChoice(employee.getId(), employee.getFullName(), employee.getDesignation(), people.rolesOf(employee)))
                .toList();
    }

    @PostMapping("/api/session/login")
    ResponseEntity<Void> login(@Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        Employee employee = people.findActive(body.employeeId()).orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Unknown employee"));

        // A fresh session on every sign in, so an old session id can never be reused (session fixation).
        HttpSession old = request.getSession(false);
        if (old != null) {
            old.invalidate();
        }
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(employee.getId(), null, List.of()));
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        return ResponseEntity.noContent().build();
    }
}
