package mv.opro.hrms.performance;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Performance", description = "Your own goals in the open appraisal cycle, your appraisals (acknowledge one once you've read it) and your probation reviews.")
@RestController
class PerformanceController {

    record Mine(CycleResponse cycle, List<GoalResponse> goals, List<AppraisalResponse> appraisals, List<ProbationReviewResponse> probationReviews) {}

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
        return new Mine(CycleResponse.of(open),
                open == null ? List.of() : performance.goalsOf(open.getId(), me.getId()).stream().map(GoalResponse::of).toList(),
                appraisals.stream().map(appraisal -> response(appraisal, names)).toList(),
                reviews.stream().map(review -> ProbationReviewResponse.of(review, names)).toList());
    }

    @PostMapping("/api/performance/appraisals/{id}/acknowledge")
    AppraisalResponse acknowledge(@PathVariable String id) {
        Appraisal appraisal = performance.acknowledge(currentUser.get(), id);
        return response(appraisal, people.namesOf(List.of(appraisal.getAppraisedBy())));
    }

    private AppraisalResponse response(Appraisal appraisal, Map<String, String> names) {
        String cycleName = performance.cycle(appraisal.getCycleId()).map(AppraisalCycle::getName).orElse("");
        return AppraisalResponse.of(appraisal, cycleName, names.get(appraisal.getAppraisedBy()), performance.goalsOf(appraisal.getCycleId(), appraisal.getEmployeeId()))
                .withoutRecommendations();
    }
}
