package mv.opro.hrms.session;

import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeResponse;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.employee.VisaRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class MeController {

    private final CurrentUser currentUser;
    private final People people;
    private final VisaRepository visas;

    MeController(CurrentUser currentUser, People people, VisaRepository visas) {
        this.currentUser = currentUser;
        this.people = people;
        this.visas = visas;
    }

    @GetMapping("/api/me")
    EmployeeResponse me() {
        Employee me = currentUser.get();
        return EmployeeResponse.of(me, people.rolesOf(me), visas.findById(me.getId()).orElse(null));
    }
}
