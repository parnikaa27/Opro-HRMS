package mv.opro.hrms.performance;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
import mv.opro.hrms.session.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Performance", description = "Your own plan in the open appraisal cycle (goals, certifications, learning, accomplishments and strengths, sent together to your HOD and then HR), your appraisals (accept the rating once you've read it) and your probation reviews.")
@RestController
class PerformanceController {

    record Mine(CycleResponse cycle, FormResponse form, List<GoalResponse> goals, List<EntryResponse> entries, List<AppraisalResponse> appraisals,
            List<ProbationReviewResponse> probationReviews) {}

    record GoalBody(@NotBlank @Size(max = 120) String title, @NotBlank @Size(max = 300) String measure, @Min(1) @Max(100) int weight) {}

    record GoalsBody(@NotNull @Size(min = 1, max = MAX_GOALS) List<@Valid GoalBody> goals) {}

    record EntryBody(@NotBlank @Size(max = 120) String title, @Size(max = 1000) String details, LocalDate targetOn) {}

    record EntriesBody(@NotNull @Size(max = MAX_ENTRIES) List<@Valid EntryBody> entries) {}

    private static final int MAX_GOALS = 10;
    private static final int MAX_ENTRIES = 20;

    private final CurrentUser currentUser;
    private final Performance performance;
    private final People people;

    PerformanceController(CurrentUser currentUser, Performance performance, People people) {
        this.currentUser = currentUser;
        this.performance = performance;
        this.people = people;
    }

    @GetMapping("/api/performance")
    Mine mine() {
        Employee me = currentUser.get();
        AppraisalCycle open = performance.openCycle().orElse(null);
        List<Appraisal> appraisals = performance.appraisalsOf(me.getId());
        List<ProbationReview> reviews = performance.reviewsOf(me.getId());
        Map<String, String> names = people.namesOf(Stream.concat(appraisals.stream().map(Appraisal::getAppraisedBy), reviews.stream().map(ProbationReview::getReviewedBy))
                .collect(Collectors.toSet()));
        return new Mine(CycleResponse.of(open), open == null ? null : formResponse(open, me),
                open == null ? List.of() : performance.goalsOf(open.getId(), me.getId()).stream().map(GoalResponse::of).toList(),
                open == null ? List.of() : performance.entriesOf(open.getId(), List.of(me.getId())).getOrDefault(me.getId(), List.of()).stream()
                        .map(EntryResponse::of).toList(),
                appraisals.stream().map(appraisal -> response(appraisal, names)).toList(),
                reviews.stream().map(review -> ProbationReviewResponse.of(review, names)).toList());
    }

    // Saving replaces them. They stay a draft until sent.
    @PutMapping("/api/performance/goals")
    List<GoalResponse> writeGoals(@Valid @RequestBody GoalsBody body) {
        return performance.writeGoals(currentUser.get(), body.goals().stream().map(goal -> new Performance.GoalPlan(goal.title(), goal.measure(), goal.weight()))
                .toList()).stream().map(GoalResponse::of).toList();
    }

    // section is certification, learning, accomplishment or strength. Saving replaces its entries.
    @PutMapping("/api/performance/sections/{section:certification|learning|accomplishment|strength}")
    List<EntryResponse> writeSection(@PathVariable String section, @Valid @RequestBody EntriesBody body) {
        return performance.writeEntries(currentUser.get(), section, body.entries().stream()
                .map(entry -> new Performance.EntryPlan(entry.title(), entry.details(), entry.targetOn())).toList()).stream().map(EntryResponse::of).toList();
    }

    // Sends the whole plan to their HOD.
    @PostMapping("/api/performance/submit")
    FormResponse submit() {
        Employee me = currentUser.get();
        performance.submit(me);
        return formResponse(performance.openCycle().orElseThrow(), me);
    }

    @PostMapping("/api/performance/appraisals/{id}/accept")
    AppraisalResponse accept(@PathVariable String id) {
        Appraisal appraisal = performance.accept(currentUser.get(), id);
        return response(appraisal, people.namesOf(List.of(appraisal.getAppraisedBy())));
    }

    private FormResponse formResponse(AppraisalCycle cycle, Employee me) {
        AppraisalForm form = performance.formOf(cycle.getId(), me.getId()).orElse(null);
        return FormResponse.of(form, form == null ? Map.of() : people.namesOf(Stream.of(form.getHodApprovedBy(), form.getDecidedBy())
                .filter(Objects::nonNull).collect(Collectors.toSet())));
    }

    private AppraisalResponse response(Appraisal appraisal, Map<String, String> names) {
        String cycleName = performance.cycle(appraisal.getCycleId()).map(AppraisalCycle::getName).orElse("");
        return AppraisalResponse.of(appraisal, cycleName, names.get(appraisal.getAppraisedBy()), performance.goalsOf(appraisal.getCycleId(), appraisal.getEmployeeId()))
                .withoutRecommendations();
    }
}
