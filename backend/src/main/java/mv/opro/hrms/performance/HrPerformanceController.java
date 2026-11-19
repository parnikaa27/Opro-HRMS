package mv.opro.hrms.performance;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.hr.HrAccess;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "HR performance", description = "Appraisal cycles HR opens and closes, how far the latest one has got, and every probation review. HR only.")
@RestController
class HrPerformanceController {

    // Someone appraised in the latest cycle, or still to be.
    record Row(String employeeId, String fullName, String department, String managerName, int goalCount, AppraisalResponse appraisal) {}

    record Overview(List<CycleResponse> cycles, List<Row> people, List<ProbationReviewResponse> probationReviews) {}

    record CycleBody(@NotBlank @Size(max = 60) String name, @NotNull LocalDate dueOn) {}

    private final HrAccess access;
    private final CurrentUser currentUser;
    private final Performance performance;
    private final People people;

    HrPerformanceController(HrAccess access, CurrentUser currentUser, Performance performance, People people) {
        this.access = access;
        this.currentUser = currentUser;
        this.performance = performance;
        this.people = people;
    }

    @GetMapping("/api/hr/performance")
    Overview overview() {
        access.require(currentUser.get());
        // Everyone with an HOD is appraised. Super admins have none.
        List<Employee> appraised = people.active().stream().filter(person -> person.getManagerId() != null).toList();
        List<ProbationReview> reviews = performance.reviews();
        Map<String, String> names = people.namesOf(Stream.of(appraised.stream().map(Employee::getManagerId), reviews.stream().map(ProbationReview::getEmployeeId),
                reviews.stream().map(ProbationReview::getReviewedBy)).flatMap(ids -> ids).filter(Objects::nonNull).collect(Collectors.toSet()));
        List<Row> rows = performance.latestCycle().map(cycle -> {
            Map<String, List<Goal>> goals = performance.goalsOf(cycle.getId(), appraised.stream().map(Employee::getId).toList());
            Map<String, Appraisal> appraisals = performance.appraisalsIn(cycle.getId());
            Map<String, String> appraisers = people.namesOf(appraisals.values().stream().map(Appraisal::getAppraisedBy).collect(Collectors.toSet()));
            return appraised.stream().map(person -> {
                List<Goal> theirs = goals.getOrDefault(person.getId(), List.of());
                Appraisal appraisal = appraisals.get(person.getId());
                return new Row(person.getId(), person.getFullName(), person.getDepartment(), names.get(person.getManagerId()), theirs.size(),
                        appraisal == null ? null : AppraisalResponse.of(appraisal, cycle.getName(), appraisers.get(appraisal.getAppraisedBy()), theirs));
            }).toList();
        }).orElse(List.of());
        return new Overview(performance.cycles().stream().map(CycleResponse::of).toList(), rows,
                reviews.stream().map(review -> ProbationReviewResponse.of(review, names)).toList());
    }

    @PostMapping("/api/hr/appraisal-cycles")
    CycleResponse open(@Valid @RequestBody CycleBody body) {
        Employee me = access.require(currentUser.get());
        return CycleResponse.of(performance.open(me, body.name(), body.dueOn()));
    }

    @PostMapping("/api/hr/appraisal-cycles/{id}/close")
    CycleResponse close(@PathVariable String id) {
        access.require(currentUser.get());
        return CycleResponse.of(performance.close(id));
    }
}
