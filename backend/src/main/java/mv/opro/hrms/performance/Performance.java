package mv.opro.hrms.performance;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Probation reviews and appraisals. HR opens a cycle; each HOD sets their reports' goals, then appraises them.
// The HOD is the only rater. Callers check the person is the HOD's report.
@Service
@Transactional(readOnly = true)
public class Performance {

    public record Review(String outcome, LocalDate extendedTo, String comments) {}

    public record GoalPlan(String title, String measure, int weight) {}

    public record GoalRating(String goalId, int rating, String comment) {}

    public record Rating(int rating, String comments, boolean recommendsPromotion, BigDecimal incrementPercent, List<GoalRating> goals) {}

    static final String EXTENDED = "extended";
    private static final int FULL_WEIGHT = 100;

    private final ProbationReviewRepository reviews;
    private final AppraisalCycleRepository cycles;
    private final GoalRepository goals;
    private final AppraisalRepository appraisals;
    private final EmployeeRepository employees;
    private final People people;
    private final Notifications notifications;
    private final Clock clock;

    Performance(ProbationReviewRepository reviews, AppraisalCycleRepository cycles, GoalRepository goals, AppraisalRepository appraisals,
            EmployeeRepository employees, People people, Notifications notifications, Clock clock) {
        this.reviews = reviews;
        this.cycles = cycles;
        this.goals = goals;
        this.appraisals = appraisals;
        this.employees = employees;
        this.people = people;
        this.notifications = notifications;
        this.clock = clock;
    }

    public Optional<AppraisalCycle> openCycle() {
        return cycles.findByClosedOnIsNull();
    }

    public List<AppraisalCycle> cycles() {
        return cycles.findAllByOrderByOpenedOnDesc();
    }

    // The cycle HR and the dashboard look at: the open one, or the last one closed.
    public Optional<AppraisalCycle> latestCycle() {
        return cycles().stream().findFirst();
    }

    // Opening a cycle asks every HOD to set goals and appraise their team.
    @Transactional
    public AppraisalCycle open(Employee hr, String name, LocalDate dueOn) {
        if (openCycle().isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "A cycle is already open. Close it before opening another.");
        }
        if (!dueOn.isAfter(today())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pick a due date after today.");
        }
        AppraisalCycle cycle = cycles.save(new AppraisalCycle(Ids.next("AY"), name.strip(), dueOn, hr.getId(), today()));
        people.active().stream()
                .filter(person -> !people.reportsOf(person.getId()).isEmpty())
                .forEach(hod -> notifications.tell(hod.getId(), Notification.Kind.PERFORMANCE, "HR opened " + cycle.getName() + ", due "
                        + Wording.date(dueOn, today()) + ". Set your team's goals and appraise them from Performance."));
        return cycle;
    }

    // Appraisals not done by then stay undone.
    @Transactional
    public AppraisalCycle close(String id) {
        AppraisalCycle cycle = cycles.findById(id).filter(AppraisalCycle::isOpen)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No open cycle with that id"));
        cycle.close(today());
        return cycle;
    }

    public List<Goal> goalsOf(String cycleId, String employeeId) {
        return goals.findByCycleIdAndEmployeeIdOrderBySortOrder(cycleId, employeeId);
    }

    public Map<String, List<Goal>> goalsOf(String cycleId, Collection<String> employeeIds) {
        return goals.findByCycleIdAndEmployeeIdInOrderBySortOrder(cycleId, employeeIds).stream().collect(Collectors.groupingBy(Goal::getEmployeeId));
    }

    public Optional<Appraisal> appraisalOf(String cycleId, String employeeId) {
        return appraisals.findByCycleIdAndEmployeeId(cycleId, employeeId);
    }

    public Map<String, Appraisal> appraisalsIn(String cycleId) {
        return appraisals.findByCycleId(cycleId).stream().collect(Collectors.toMap(Appraisal::getEmployeeId, Function.identity()));
    }

    public List<Appraisal> appraisalsOf(String employeeId) {
        return appraisals.findByEmployeeIdOrderByAppraisedOnDesc(employeeId);
    }

    public Optional<AppraisalCycle> cycle(String id) {
        return cycles.findById(id);
    }

    // Replaces their goals in the open cycle, until they're appraised.
    @Transactional
    public List<Goal> setGoals(Employee hod, String employeeId, List<GoalPlan> plans) {
        AppraisalCycle cycle = requireOpen();
        refuseIfAppraised(cycle, employeeId);
        if (plans.stream().mapToInt(GoalPlan::weight).sum() != FULL_WEIGHT) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Goal weights need to add up to 100%.");
        }
        goals.deleteByCycleIdAndEmployeeId(cycle.getId(), employeeId);
        goals.flush();
        List<Goal> saved = goals.saveAll(IntStream.range(0, plans.size())
                .mapToObj(index -> new Goal(Ids.next("GL"), cycle.getId(), employeeId, plans.get(index).title().strip(), plans.get(index).measure().strip(),
                        plans.get(index).weight(), index))
                .toList());
        notifications.tell(employeeId, Notification.Kind.PERFORMANCE, hod.getFullName() + " set your goals for " + cycle.getName() + ". See them on Performance.");
        return saved;
    }

    // Final once saved. Every goal they have gets a rating.
    @Transactional
    public Appraisal appraise(Employee hod, String employeeId, Rating rating) {
        AppraisalCycle cycle = requireOpen();
        refuseIfAppraised(cycle, employeeId);
        Map<String, GoalRating> given = rating.goals().stream().collect(Collectors.toMap(GoalRating::goalId, Function.identity(), (first, second) -> second));
        List<Goal> theirs = goalsOf(cycle.getId(), employeeId);
        if (theirs.stream().anyMatch(goal -> !given.containsKey(goal.getId())) || given.size() != theirs.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Rate each of their goals.");
        }
        theirs.forEach(goal -> goal.rate(given.get(goal.getId()).rating(), blankToNull(given.get(goal.getId()).comment())));
        Appraisal appraisal = appraisals.save(new Appraisal(Ids.next("AP"), cycle.getId(), employeeId, rating.rating(), rating.comments().strip(),
                rating.recommendsPromotion(), rating.incrementPercent(), hod.getId(), today()));
        notifications.tell(employeeId, Notification.Kind.PERFORMANCE, hod.getFullName() + " finished your " + cycle.getName()
                + ". Read it on Performance and let them know you've seen it.");
        return appraisal;
    }

    @Transactional
    public Appraisal acknowledge(Employee me, String id) {
        Appraisal appraisal = appraisals.findById(id).filter(found -> found.getEmployeeId().equals(me.getId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Appraisal not found"));
        if (appraisal.getAcknowledgedOn() == null) {
            appraisal.acknowledge(today());
        }
        return appraisal;
    }

    public List<ProbationReview> reviewsOf(String employeeId) {
        return reviews.findByEmployeeIdOrderByReviewedOnDesc(employeeId);
    }

    public List<ProbationReview> reviews() {
        return reviews.findAllByOrderByReviewedOnDesc();
    }

    // Confirmed clears their probation date and extended moves it. Not confirmed leaves it for HR, who are told either way.
    @Transactional
    public ProbationReview review(Employee hod, String employeeId, Review review) {
        Employee person = employees.findById(employeeId).orElseThrow();
        LocalDate ends = person.getProbationEndsOn();
        if (ends == null) {
            throw new ApiException(HttpStatus.CONFLICT, "They aren't on probation.");
        }
        boolean isExtended = EXTENDED.equals(review.outcome());
        if (isExtended && (review.extendedTo() == null || !review.extendedTo().isAfter(ends))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pick a new end date after " + Wording.date(ends, today()) + ".");
        }
        ProbationReview saved = reviews.save(new ProbationReview(Ids.next("PR"), employeeId, ends, review.outcome(), isExtended ? review.extendedTo() : null,
                review.comments().strip(), hod.getId(), today()));
        String outcome = switch (review.outcome()) {
            case "confirmed" -> "confirmed in their role";
            case EXTENDED -> "on probation until " + Wording.date(review.extendedTo(), today());
            default -> "not confirmed in their role";
        };
        if ("confirmed".equals(review.outcome())) {
            person.confirm();
        } else if (isExtended) {
            person.extendProbation(review.extendedTo());
        }
        notifications.tell(employeeId, Notification.Kind.PERFORMANCE, hod.getFullName() + " reviewed your probation: you're " + outcome.replace("their", "your")
                + ".");
        people.active().stream()
                .filter(Employee::isHr)
                .filter(hr -> !hr.getId().equals(employeeId))
                .forEach(hr -> notifications.tell(hr.getId(), Notification.Kind.PERFORMANCE, hod.getFullName() + " reviewed " + person.getFullName()
                        + "'s probation: " + outcome + "."));
        return saved;
    }

    private AppraisalCycle requireOpen() {
        return openCycle().orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "No appraisal cycle is open. HR opens one."));
    }

    private void refuseIfAppraised(AppraisalCycle cycle, String employeeId) {
        if (appraisalOf(cycle.getId(), employeeId).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "They've already been appraised in " + cycle.getName() + ".");
        }
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }
}
