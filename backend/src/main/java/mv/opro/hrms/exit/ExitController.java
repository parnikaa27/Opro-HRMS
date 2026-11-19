package mv.opro.hrms.exit;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.session.CurrentUser;
import mv.opro.hrms.team.TeamAccess;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// Resigning, and the HOD's step on their reports' resignations (a super admin's on anyone's, never their own).
@Tag(name = "Resignation", description = "Your own resignation, and the HOD's decision on their reports'. HR's step is under HR: exit.")
@RestController
class ExitController {

    private static final int MAX_REASON = 500;
    private static final int MAX_NOTE = 300;

    record ResignBody(@NotBlank @Size(max = MAX_REASON) String reason, @NotNull LocalDate releaseOn) {}

    record DecisionBody(@NotNull @Pattern(regexp = "approved|rejected") String decision, @Size(max = MAX_NOTE) String note) {}

    private final Exits exits;
    private final CurrentUser currentUser;
    private final TeamAccess access;
    private final People people;

    ExitController(Exits exits, CurrentUser currentUser, TeamAccess access, People people) {
        this.exits = exits;
        this.currentUser = currentUser;
        this.access = access;
        this.people = people;
    }

    @GetMapping("/api/resignation")
    List<ResignationResponse> mine() {
        return exits.of(currentUser.get().getId()).stream().map(view -> ResignationResponse.of(view, namesFor(List.of(view.resignation())))).toList();
    }

    @PostMapping("/api/resignation")
    ResignationResponse resign(@Valid @RequestBody ResignBody body) {
        Exits.View view = exits.resign(currentUser.get(), body.reason(), body.releaseOn());
        return ResignationResponse.of(view, namesFor(List.of(view.resignation())));
    }

    @PostMapping("/api/resignation/{id}/withdraw")
    ResignationResponse withdraw(@PathVariable String id) {
        Exits.View view = exits.withdraw(currentUser.get(), id);
        return ResignationResponse.of(view, namesFor(List.of(view.resignation())));
    }

    @GetMapping("/api/{scope:team|company}/resignations")
    List<ResignationResponse> team(@PathVariable String scope, @RequestParam(required = false) String status) {
        List<Resignation> found = exits.forTeam(inScope(scope).stream().map(Employee::getId).toList(), status);
        Map<String, String> names = namesFor(found);
        return found.stream().map(resignation -> ResignationResponse.of(resignation, names)).toList();
    }

    @PostMapping("/api/{scope:team|company}/resignations/{id}/decision")
    ResignationResponse decide(@PathVariable String scope, @PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = currentUser.get();
        Set<String> decidable = inScope(scope).stream().map(Employee::getId).filter(employeeId -> !employeeId.equals(me.getId())).collect(Collectors.toSet());
        Resignation decided = exits.decideAsHod(me, id, decidable, body.decision(), body.note());
        return ResignationResponse.of(decided, namesFor(List.of(decided)));
    }

    private List<Employee> inScope(String scope) {
        Employee me = currentUser.get();
        return "company".equals(scope) ? access.everyoneFor(me) : access.reportsOf(me);
    }

    private Map<String, String> namesFor(List<Resignation> resignations) {
        return people.namesOf(resignations.stream()
                .flatMap(resignation -> Stream.of(resignation.getEmployeeId(), resignation.getHodApprovedBy(), resignation.getDecidedBy()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
    }
}
