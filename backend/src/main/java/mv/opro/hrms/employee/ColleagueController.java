package mv.opro.hrms.employee;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Colleagues", description = "Everyone working at Opro today, for search. Only what a colleague may see: name, role, department, work email and photo.")
@RestController
class ColleagueController {

    record Colleague(String id, String fullName, String designation, String department, String email, String photoUrl) {}

    private final People people;
    private final Photos photos;
    private final CurrentUser currentUser;

    ColleagueController(People people, Photos photos, CurrentUser currentUser) {
        this.people = people;
        this.photos = photos;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/people")
    List<Colleague> colleagues() {
        currentUser.get();
        return people.active().stream()
                .map(person -> new Colleague(person.getId(), person.getFullName(), person.getDesignation(), person.getDepartment(), person.getEmail(),
                        photos.urlOf(person.getId()).orElse(null)))
                .toList();
    }
}
