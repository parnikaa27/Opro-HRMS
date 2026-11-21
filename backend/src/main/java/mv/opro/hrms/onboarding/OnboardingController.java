package mv.opro.hrms.onboarding;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.hr.HrAccess;
import mv.opro.hrms.session.CurrentUser;
import mv.opro.hrms.team.TeamAccess;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// Onboarding for the joiner, their HOD and HR. Ticking a task is one route for all three; the server checks it's theirs.
@Tag(name = "Onboarding", description = "A new joiner's tasks, first day and buddy: the joiner's own view, the HOD's team, and HR's list and progress.")
@RestController
class OnboardingController {

    private static final int MAX_DAYS = 90;

    record BuddyBody(@NotBlank String buddyId) {}

    record FirstDayBody(@Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d") String time, @Size(max = 120) String place, @Size(max = 120) String contact) {}

    record TaskBody(@NotBlank @Size(max = 120) String name, @NotNull @Pattern(regexp = "hr|hod|joiner") String owner,
            @Min(-MAX_DAYS) @Max(MAX_DAYS) int dueInDays) {}

    record TaskResponse(String id, String name, String owner, int dueInDays) {

        static TaskResponse of(OnboardingTask task) {
            return new TaskResponse(task.getId(), task.getName(), task.getOwner(), task.getDueInDays());
        }
    }

    private final Onboardings onboardings;
    private final CurrentUser currentUser;
    private final TeamAccess team;
    private final HrAccess hr;
    private final EmployeeRepository employees;
    private final People people;

    OnboardingController(Onboardings onboardings, CurrentUser currentUser, TeamAccess team, HrAccess hr, EmployeeRepository employees, People people) {
        this.onboardings = onboardings;
        this.currentUser = currentUser;
        this.team = team;
        this.hr = hr;
        this.employees = employees;
        this.people = people;
    }

    // No content when they aren't onboarding.
    @GetMapping("/api/onboarding")
    ResponseEntity<OnboardingResponse> mine() {
        return onboardings.of(currentUser.get().getId()).map(view -> ResponseEntity.ok(views(List.of(view)).getFirst()))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping("/api/onboarding/{employeeId}/items/{itemId}/done")
    OnboardingResponse tick(@PathVariable String employeeId, @PathVariable String itemId) {
        return views(List.of(onboardings.tick(reader(employeeId), employeeId, itemId, true))).getFirst();
    }

    @DeleteMapping("/api/onboarding/{employeeId}/items/{itemId}/done")
    OnboardingResponse untick(@PathVariable String employeeId, @PathVariable String itemId) {
        return views(List.of(onboardings.tick(reader(employeeId), employeeId, itemId, false))).getFirst();
    }

    @GetMapping("/api/team/onboarding")
    List<OnboardingResponse> team() {
        return views(onboardings.inProgress(team.reportsOf(currentUser.get()).stream().map(Employee::getId).toList()));
    }

    @PutMapping("/api/team/onboarding/{employeeId}/buddy")
    OnboardingResponse buddy(@PathVariable String employeeId, @Valid @RequestBody BuddyBody body) {
        Employee me = currentUser.get();
        if (!onboardings.isTheirHod(me, employeeId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Not one of your reports");
        }
        return views(List.of(onboardings.setBuddy(me, employeeId, body.buddyId()))).getFirst();
    }

    @GetMapping("/api/hr/onboarding")
    List<OnboardingResponse> inProgress() {
        hr.require(currentUser.get());
        return views(onboardings.inProgress());
    }

    @GetMapping("/api/hr/employees/{id}/onboarding")
    ResponseEntity<OnboardingResponse> of(@PathVariable String id) {
        hr.require(currentUser.get());
        return onboardings.of(id).map(view -> ResponseEntity.ok(views(List.of(view)).getFirst())).orElseGet(() -> ResponseEntity.noContent().build());
    }

    // For someone added before onboarding existed.
    @PostMapping("/api/hr/employees/{id}/onboarding")
    OnboardingResponse start(@PathVariable String id) {
        return views(List.of(onboardings.start(someoneElse(id)))).getFirst();
    }

    @PutMapping("/api/hr/employees/{id}/onboarding/first-day")
    OnboardingResponse firstDay(@PathVariable String id, @Valid @RequestBody FirstDayBody body) {
        someoneElse(id);
        return views(List.of(onboardings.setFirstDay(id, new Onboarding.FirstDay(body.time(), body.place(), body.contact())))).getFirst();
    }

    @GetMapping("/api/hr/onboarding-tasks")
    List<TaskResponse> tasks() {
        hr.require(currentUser.get());
        return onboardings.tasks().stream().map(TaskResponse::of).toList();
    }

    @PostMapping("/api/hr/onboarding-tasks")
    TaskResponse addTask(@Valid @RequestBody TaskBody body) {
        hr.require(currentUser.get());
        return TaskResponse.of(onboardings.addTask(body.name(), body.owner(), body.dueInDays()));
    }

    @DeleteMapping("/api/hr/onboarding-tasks/{id}")
    ResponseEntity<Void> removeTask(@PathVariable String id) {
        hr.require(currentUser.get());
        onboardings.removeTask(id);
        return ResponseEntity.noContent().build();
    }

    // The signed in person, if they may see this onboarding at all.
    private Employee reader(String employeeId) {
        Employee me = currentUser.get();
        if (!onboardings.canSee(me, employeeId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "No onboarding for them.");
        }
        return me;
    }

    // HR, acting on someone who isn't them. Returns that someone.
    private Employee someoneElse(String id) {
        Employee me = hr.require(currentUser.get());
        if (me.getId().equals(id)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Another HR person handles your own onboarding.");
        }
        return employees.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employee not found"));
    }

    private List<OnboardingResponse> views(List<Onboardings.View> views) {
        Map<String, Employee> joiners = employees.findAllById(views.stream().map(view -> view.onboarding().getEmployeeId()).toList()).stream()
                .collect(Collectors.toMap(Employee::getId, Function.identity()));
        Map<String, String> names = people.namesOf(views.stream()
                .flatMap(view -> Stream.concat(Stream.of(view.onboarding().getBuddyId(), joiners.get(view.onboarding().getEmployeeId()).getManagerId()),
                        view.items().stream().map(OnboardingItem::getDoneBy)))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        return views.stream().map(view -> {
            Employee joiner = joiners.get(view.onboarding().getEmployeeId());
            return OnboardingResponse.of(view, new OnboardingResponse.Person(joiner.getFullName(), joiner.getDesignation(), joiner.getManagerId()), names);
        }).toList();
    }
}
