package mv.opro.hrms.session;

import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeResponse;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.employee.Photos;
import mv.opro.hrms.employee.VisaRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Me", description = "The signed in person: profile, roles and visa.")
@RestController
class MeController {

    private final CurrentUser currentUser;
    private final People people;
    private final VisaRepository visas;
    private final Photos photos;

    MeController(CurrentUser currentUser, People people, VisaRepository visas, Photos photos) {
        this.currentUser = currentUser;
        this.people = people;
        this.visas = visas;
        this.photos = photos;
    }

    @GetMapping("/api/me")
    EmployeeResponse me() {
        Employee me = currentUser.get();
        return EmployeeResponse.of(me, people.rolesOf(me), visas.findById(me.getId()).orElse(null), photos.urlOf(me.getId()).orElse(null));
    }
}
