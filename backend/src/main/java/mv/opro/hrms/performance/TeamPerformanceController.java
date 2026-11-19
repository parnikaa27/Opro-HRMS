package mv.opro.hrms.performance;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.session.CurrentUser;
import mv.opro.hrms.team.TeamAccess;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Team performance", description = "An HOD's direct reports in the open appraisal cycle: approve the goals they write, appraise them, and review probation before it ends.")
@RestController
class TeamPerformanceController {

    private static final int LOWEST = 1;
    private static final int HIGHEST = 5;

    record Member(String employeeId, String fullName, String designation, LocalDate probationEndsOn, FormResponse form, List<GoalResponse> goals,
            AppraisalResponse appraisal) {}

    record Team(CycleResponse cycle, List<Member> people) {}

    record DecisionBody(@NotNull @Pattern(regexp = "approved|rejected") String decision, @Size(max = 300) String note) {}

    record GoalRatingBody(@NotBlank String goalId, @Min(LOWEST) @Max(HIGHEST) int rating, @Size(max = 500) String comment) {}

    record AppraisalBody(@Min(LOWEST) @Max(HIGHEST) int rating, @NotBlank @Size(max = 2000) String comments, @NotNull Boolean recommendsPromotion,
            @DecimalMin("0.1") @DecimalMax("100") BigDecimal incrementPercent, @NotNull List<@Valid GoalRatingBody> goals,
            @Size(max = 2000) String selfReviewComment) {}

    record ReviewBody(@NotNull @Pattern(regexp = "confirmed|extended|not-confirmed") String outcome, LocalDate extendedTo,
            @NotBlank @Size(max = 1000) String comments) {}

    private final TeamAccess access;
    private final CurrentUser currentUser;
    private final Performance performance;
    private final People people;

    TeamPerformanceController(TeamAccess access, CurrentUser currentUser, Performance performance, People people) {
        this.access = access;
        this.currentUser = currentUser;
        this.performance = performance;
        this.people = people;
    }

    @GetMapping("/api/team/performance")
    Team team() {
        Employee me = currentUser.get();
        List<Employee> reports = access.reportsOf(me);
        AppraisalCycle cycle = performance.openCycle().orElse(null);
        if (cycle == null) {
            return new Team(null, reports.stream().map(person -> member(person, null, List.of(), null)).toList());
        }
        List<String> ids = reports.stream().map(Employee::getId).toList();
        Map<String, List<Goal>> goals = performance.goalsOf(cycle.getId(), ids);
        Map<String, AppraisalForm> forms = performance.formsOf(cycle.getId(), ids);
        Map<String, Appraisal> appraisals = performance.appraisalsIn(cycle.getId());
        Map<String, String> names = people.namesOf(forms.values().stream().flatMap(form -> Stream.of(form.getHodApprovedBy(), form.getGoalsDecidedBy()))
                .filter(Objects::nonNull).collect(Collectors.toSet()));
        return new Team(CycleResponse.of(cycle), reports.stream().map(person -> {
            List<Goal> theirs = goals.getOrDefault(person.getId(), List.of());
            Appraisal appraisal = appraisals.get(person.getId());
            return member(person, FormResponse.of(forms.get(person.getId()), names), theirs,
                    appraisal == null ? null : AppraisalResponse.of(appraisal, cycle.getName(), me.getFullName(), theirs));
        }).toList());
    }

    // Approve the goals they sent, or send them back with a note.
    @PostMapping("/api/team/performance/{employeeId}/goals/decision")
    ResponseEntity<Void> decideGoals(@PathVariable String employeeId, @Valid @RequestBody DecisionBody body) {
        Employee me = currentUser.get();
        performance.decideGoalsAsHod(me, reportOf(me, employeeId).getId(), "approved".equals(body.decision()), body.note());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/team/performance/{employeeId}/appraisal")
    AppraisalResponse appraise(@PathVariable String employeeId, @Valid @RequestBody AppraisalBody body) {
        Employee me = currentUser.get();
        String id = reportOf(me, employeeId).getId();
        Appraisal appraisal = performance.appraise(me, id, new Performance.Rating(body.rating(), body.comments(), body.recommendsPromotion(),
                body.incrementPercent(), body.goals().stream().map(goal -> new Performance.GoalRating(goal.goalId(), goal.rating(), goal.comment())).toList(),
                body.selfReviewComment()));
        String cycleName = performance.cycle(appraisal.getCycleId()).map(AppraisalCycle::getName).orElse("");
        return AppraisalResponse.of(appraisal, cycleName, me.getFullName(), performance.goalsOf(appraisal.getCycleId(), id));
    }

    @PostMapping("/api/team/performance/{employeeId}/probation-review")
    ProbationReviewResponse review(@PathVariable String employeeId, @Valid @RequestBody ReviewBody body) {
        Employee me = currentUser.get();
        Employee person = reportOf(me, employeeId);
        ProbationReview review = performance.review(me, person.getId(), new Performance.Review(body.outcome(), body.extendedTo(), body.comments()));
        return ProbationReviewResponse.of(review, Map.of(person.getId(), person.getFullName(), me.getId(), me.getFullName()));
    }

    private Employee reportOf(Employee me, String employeeId) {
        return access.reportsOf(me).stream().filter(person -> person.getId().equals(employeeId)).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not one of your reports"));
    }

    private static Member member(Employee person, FormResponse form, List<Goal> goals, AppraisalResponse appraisal) {
        return new Member(person.getId(), person.getFullName(), person.getDesignation(), person.getProbationEndsOn(), form,
                goals.stream().map(GoalResponse::of).toList(), appraisal);
    }
}
