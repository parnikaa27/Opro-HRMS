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

// Probation reviews and appraisals. HR opens a cycle; each person writes a plan (goals, certifications, learning,
// accomplishments and strengths), which their HOD and then HR approve. Then the HOD appraises them, the only rater, and
// the person accepts the rating. Callers check the person is the HOD's report, or that a super admin is stepping in.
@Service
@Transactional(readOnly = true)
public class Performance {

    public record Review(String outcome, LocalDate extendedTo, String comments) {}

    public record GoalPlan(String title, String measure, int weight) {}

    // targetOn is for certifications only.
    public record EntryPlan(String title, String details, LocalDate targetOn) {}

    static final String CERTIFICATION = "certification";

    public record GoalRating(String goalId, int rating, String comment) {}

    public record Rating(int rating, String comments, boolean recommendsPromotion, BigDecimal incrementPercent, List<GoalRating> goals,
            String selfReviewComment) {}

    static final String EXTENDED = "extended";
    private static final int FULL_WEIGHT = 100;

    private final ProbationReviewRepository reviews;
    private final AppraisalCycleRepository cycles;
    private final GoalRepository goals;
    private final AppraisalRepository appraisals;
    private final AppraisalFormRepository forms;
    private final PerformanceEntryRepository entries;
    private final EmployeeRepository employees;
    private final People people;
    private final Notifications notifications;
    private final Clock clock;

    Performance(ProbationReviewRepository reviews, AppraisalCycleRepository cycles, GoalRepository goals, AppraisalRepository appraisals,
            AppraisalFormRepository forms, PerformanceEntryRepository entries, EmployeeRepository employees, People people, Notifications notifications,
            Clock clock) {
        this.reviews = reviews;
        this.cycles = cycles;
        this.goals = goals;
        this.appraisals = appraisals;
        this.forms = forms;
        this.entries = entries;
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

    // Opening a cycle asks everyone with an HOD to write their goals, and every HOD to approve and appraise them.
    @Transactional
    public AppraisalCycle open(Employee hr, String name, LocalDate dueOn) {
        if (openCycle().isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "A cycle is already open. Close it before opening another.");
        }
        if (!dueOn.isAfter(today())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pick a due date after today.");
        }
        AppraisalCycle cycle = cycles.save(new AppraisalCycle(Ids.next("AY"), name.strip(), dueOn, hr.getId(), today()));
        String due = cycle.getName() + ", due " + Wording.date(dueOn, today()) + ".";
        people.active().forEach(person -> {
            if (person.getManagerId() != null) {
                notifications.tell(person.getId(), Notification.Kind.PERFORMANCE, "HR opened " + due + " Write your plan on Performance and send it to your HOD.");
            }
            if (!people.reportsOf(person.getId()).isEmpty()) {
                notifications.tell(person.getId(), Notification.Kind.PERFORMANCE, "HR opened " + due + " Approve your team's plans, then appraise them.");
            }
        });
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

    public Map<String, List<PerformanceEntry>> entriesOf(String cycleId, Collection<String> employeeIds) {
        return entries.findByCycleIdAndEmployeeIdInOrderBySectionAscSortOrderAsc(cycleId, employeeIds).stream()
                .collect(Collectors.groupingBy(PerformanceEntry::getEmployeeId));
    }

    public Optional<AppraisalForm> formOf(String cycleId, String employeeId) {
        return forms.findByCycleIdAndEmployeeId(cycleId, employeeId);
    }

    public Map<String, AppraisalForm> formsOf(String cycleId, Collection<String> employeeIds) {
        return forms.findByCycleIdAndEmployeeIdIn(cycleId, employeeIds).stream().collect(Collectors.toMap(AppraisalForm::getEmployeeId, Function.identity()));
    }

    // Someone writes their own goals in the open cycle, while they're a draft or sent back. Saving replaces them.
    @Transactional
    public List<Goal> writeGoals(Employee me, List<GoalPlan> plans) {
        AppraisalCycle cycle = requireOpen();
        requireEditable(formFor(cycle, me));
        if (plans.stream().mapToInt(GoalPlan::weight).sum() != FULL_WEIGHT) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Goal weights need to add up to 100%.");
        }
        goals.deleteByCycleIdAndEmployeeId(cycle.getId(), me.getId());
        goals.flush();
        return goals.saveAll(IntStream.range(0, plans.size())
                .mapToObj(index -> new Goal(Ids.next("GL"), cycle.getId(), me.getId(), plans.get(index).title().strip(), plans.get(index).measure().strip(),
                        plans.get(index).weight(), index))
                .toList());
    }

    // Saving a section replaces its entries. The plan stays a draft until sent.
    @Transactional
    public List<PerformanceEntry> writeEntries(Employee me, String section, List<EntryPlan> plans) {
        AppraisalCycle cycle = requireOpen();
        requireEditable(formFor(cycle, me));
        entries.deleteByCycleIdAndEmployeeIdAndSection(cycle.getId(), me.getId(), section);
        entries.flush();
        return entries.saveAll(IntStream.range(0, plans.size())
                .mapToObj(index -> new PerformanceEntry(Ids.next("PE"), cycle.getId(), me.getId(), section, plans.get(index).title().strip(),
                        blankToNull(plans.get(index).details()), CERTIFICATION.equals(section) ? plans.get(index).targetOn() : null, index))
                .toList());
    }

    // Sends the whole plan to their HOD. Goals are needed; the other sections can be empty.
    @Transactional
    public AppraisalForm submit(Employee me) {
        AppraisalCycle cycle = requireOpen();
        AppraisalForm form = requireEditable(formFor(cycle, me));
        if (goalsOf(cycle.getId(), me.getId()).isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Add at least one goal first.");
        }
        form.submit(today());
        notifications.tell(me.getManagerId(), Notification.Kind.PERFORMANCE, me.getFullName() + " sent their plan for " + cycle.getName()
                + ". Approve it or send it back from Performance.");
        return form;
    }

    // The HOD's step, or a super admin's standing in for them. Approving passes the plan to HR, unless they are HR.
    // Sending it back needs a note.
    @Transactional
    public AppraisalForm decideAsHod(Employee hod, String employeeId, boolean isApproved, String note) {
        AppraisalCycle cycle = requireOpen();
        if (hod.getId().equals(employeeId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Your own plan goes to your HOD.");
        }
        AppraisalForm form = formOf(cycle.getId(), employeeId).filter(found -> AppraisalForm.SUBMITTED.equals(found.getStatus()))
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "Their plan isn't waiting for an HOD."));
        if (!isApproved) {
            return sendBack(hod, form, cycle, note);
        }
        if (hod.isHr()) {
            return approve(hod, form, cycle);
        }
        form.approveForHod(hod.getId(), today());
        String name = people.namesOf(List.of(employeeId)).get(employeeId);
        notifications.tell(employeeId, Notification.Kind.PERFORMANCE, hod.getFullName() + " approved your plan for " + cycle.getName() + ". It now waits for HR.");
        people.active().stream().filter(Employee::isHr).filter(hr -> !hr.getId().equals(employeeId))
                .forEach(hr -> notifications.tell(hr.getId(), Notification.Kind.PERFORMANCE, hod.getFullName() + " approved " + name + "'s plan for "
                        + cycle.getName() + ". Approve it from Performance."));
        return form;
    }

    // HR's step, never on their own plan.
    @Transactional
    public AppraisalForm decideAsHr(Employee hr, String employeeId, boolean isApproved, String note) {
        AppraisalCycle cycle = requireOpen();
        if (hr.getId().equals(employeeId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Your own plan goes to another HR person.");
        }
        AppraisalForm form = formOf(cycle.getId(), employeeId).filter(found -> AppraisalForm.HOD_APPROVED.equals(found.getStatus()))
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "Their plan isn't waiting for HR."));
        return isApproved ? approve(hr, form, cycle) : sendBack(hr, form, cycle, note);
    }

    private AppraisalForm formFor(AppraisalCycle cycle, Employee me) {
        if (me.getManagerId() == null) {
            throw new ApiException(HttpStatus.CONFLICT, "You have no HOD to appraise you.");
        }
        return formOf(cycle.getId(), me.getId()).orElseGet(() -> forms.save(new AppraisalForm(Ids.next("AF"), cycle.getId(), me.getId())));
    }

    private static AppraisalForm requireEditable(AppraisalForm form) {
        if (!form.canEdit()) {
            throw new ApiException(HttpStatus.CONFLICT, "Your plan is with your HOD or HR, or already approved.");
        }
        return form;
    }

    private AppraisalForm approve(Employee by, AppraisalForm form, AppraisalCycle cycle) {
        form.decide(true, by.getId(), today(), null);
        notifications.tell(form.getEmployeeId(), Notification.Kind.PERFORMANCE, "Your plan for " + cycle.getName() + " is approved.");
        return form;
    }

    private AppraisalForm sendBack(Employee by, AppraisalForm form, AppraisalCycle cycle, String note) {
        String clean = blankToNull(note);
        if (clean == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Say what to change, so they can fix it.");
        }
        form.decide(false, by.getId(), today(), clean);
        notifications.tell(form.getEmployeeId(), Notification.Kind.PERFORMANCE, by.getFullName() + " sent back your plan for " + cycle.getName() + ": "
                + Wording.sentence(clean) + " Change it on Performance and send it again.");
        return form;
    }

    // Final once saved, once their plan is approved. Every goal gets a rating; the HOD can comment on what they wrote.
    @Transactional
    public Appraisal appraise(Employee hod, String employeeId, Rating rating) {
        AppraisalCycle cycle = requireOpen();
        if (hod.getId().equals(employeeId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Your own appraisal is your HOD's.");
        }
        refuseIfAppraised(cycle, employeeId);
        if (!formOf(cycle.getId(), employeeId).map(form -> AppraisalForm.APPROVED.equals(form.getStatus())).orElse(false)) {
            throw new ApiException(HttpStatus.CONFLICT, "Their plan needs approving by their HOD and HR first.");
        }
        Map<String, GoalRating> given = rating.goals().stream().collect(Collectors.toMap(GoalRating::goalId, Function.identity(), (first, second) -> second));
        List<Goal> theirs = goalsOf(cycle.getId(), employeeId);
        if (theirs.stream().anyMatch(goal -> !given.containsKey(goal.getId())) || given.size() != theirs.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Rate each of their goals.");
        }
        theirs.forEach(goal -> goal.rate(given.get(goal.getId()).rating(), blankToNull(given.get(goal.getId()).comment())));
        Appraisal appraisal = appraisals.save(new Appraisal(Ids.next("AP"), cycle.getId(), employeeId, rating.rating(), rating.comments().strip(),
                rating.recommendsPromotion(), rating.incrementPercent(), hod.getId(), today(), blankToNull(rating.selfReviewComment())));
        notifications.tell(employeeId, Notification.Kind.PERFORMANCE, hod.getFullName() + " finished your " + cycle.getName()
                + ". Read it on Performance and accept your rating.");
        return appraisal;
    }

    // Accepting the rating is how an appraisal ends. There's no disagreeing in the portal.
    @Transactional
    public Appraisal accept(Employee me, String id) {
        Appraisal appraisal = appraisals.findById(id).filter(found -> found.getEmployeeId().equals(me.getId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Appraisal not found"));
        if (appraisal.getAcceptedOn() == null) {
            appraisal.accept(today());
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
