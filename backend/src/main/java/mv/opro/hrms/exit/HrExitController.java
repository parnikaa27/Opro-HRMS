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
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.hr.HrAccess;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// HR's side of leaving: the step after the HOD, which sets the exit date, the checklist of what comes back, and the list
// itself. Never their own.
@Tag(name = "HR: exit", description = "Resignations waiting for HR, the exit date, ticking off what comes back, and HR's list of items. HR only.")
@RestController
class HrExitController {

    private static final int MAX_NOTE = 300;
    private static final int MAX_NAME = 60;

    record DecisionBody(@NotNull @Pattern(regexp = "approved|rejected") String decision, LocalDate exitOn, @Size(max = MAX_NOTE) String note) {}

    record TickBody(@NotNull @Pattern(regexp = "returned|not-given") String outcome) {}

    record ItemBody(@NotBlank @Size(max = MAX_NAME) String name) {}

    record ItemResponse(String id, String name) {}

    private final Exits exits;
    private final HrAccess hr;
    private final CurrentUser currentUser;
    private final People people;

    HrExitController(Exits exits, HrAccess hr, CurrentUser currentUser, People people) {
        this.exits = exits;
        this.hr = hr;
        this.currentUser = currentUser;
        this.people = people;
    }

    @GetMapping("/api/hr/resignations")
    List<ResignationResponse> waiting() {
        List<Resignation> waiting = exits.waitingForHr(hr.require(currentUser.get()));
        Map<String, String> names = namesFor(waiting);
        return waiting.stream().map(resignation -> ResignationResponse.of(resignation, names)).toList();
    }

    @PostMapping("/api/hr/resignations/{id}/decision")
    ResignationResponse decide(@PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Resignation decided = exits.decideAsHr(hr.require(currentUser.get()), id, body.decision(), body.exitOn(), body.note());
        return ResignationResponse.of(decided, namesFor(List.of(decided)));
    }

    // No content when they haven't resigned.
    @GetMapping("/api/hr/employees/{id}/exit")
    ResponseEntity<ResignationResponse> exitOf(@PathVariable String id) {
        hr.require(currentUser.get());
        return exits.exitOf(id).map(view -> ResponseEntity.ok(view(view))).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/api/hr/employees/{id}/exit/items/{itemId}")
    ResignationResponse tick(@PathVariable String id, @PathVariable String itemId, @Valid @RequestBody TickBody body) {
        return view(exits.tick(someoneElse(id), id, itemId, body.outcome()));
    }

    @DeleteMapping("/api/hr/employees/{id}/exit/items/{itemId}")
    ResignationResponse untick(@PathVariable String id, @PathVariable String itemId) {
        return view(exits.tick(someoneElse(id), id, itemId, null));
    }

    @GetMapping("/api/hr/exit-items")
    List<ItemResponse> items() {
        hr.require(currentUser.get());
        return exits.items().stream().map(item -> new ItemResponse(item.getId(), item.getName())).toList();
    }

    @PostMapping("/api/hr/exit-items")
    ItemResponse addItem(@Valid @RequestBody ItemBody body) {
        hr.require(currentUser.get());
        ExitItem item = exits.addItem(body.name());
        return new ItemResponse(item.getId(), item.getName());
    }

    @DeleteMapping("/api/hr/exit-items/{id}")
    ResponseEntity<Void> removeItem(@PathVariable String id) {
        hr.require(currentUser.get());
        exits.removeItem(id);
        return ResponseEntity.noContent().build();
    }

    private Employee someoneElse(String id) {
        Employee me = hr.require(currentUser.get());
        if (me.getId().equals(id)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Another HR person handles your own exit.");
        }
        return me;
    }

    private ResignationResponse view(Exits.View view) {
        return ResignationResponse.of(view, namesFor(List.of(view.resignation())));
    }

    private Map<String, String> namesFor(List<Resignation> resignations) {
        return people.namesOf(resignations.stream()
                .flatMap(resignation -> Stream.of(resignation.getEmployeeId(), resignation.getHodApprovedBy(), resignation.getDecidedBy()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
    }
}
