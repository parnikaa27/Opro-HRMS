package mv.opro.hrms.approval;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// The HR step after the HOD. HR sets which requests need it: per leave type in the policy, and once each for punch fixes,
// home days, comp off and overtime here. An HOD who is HR covers both steps. Super admins step in on the HOD step only.
@Service
@Transactional(readOnly = true)
public class ApprovalSteps {

    public enum Kind {
        CORRECTION("correction"), HOME_DAY("home-day"), COMP_OFF("comp-off"), OVERTIME("overtime");

        private final String value;

        Kind(String value) {
            this.value = value;
        }
    }

    // The four switches as HR sees them in Policies.
    public record Rules(boolean punchFixes, boolean homeDays, boolean compOff, boolean overtime) {}

    private final ApprovalRuleRepository rules;
    private final People people;
    private final Notifications notifications;

    ApprovalSteps(ApprovalRuleRepository rules, People people, Notifications notifications) {
        this.rules = rules;
        this.people = people;
        this.notifications = notifications;
    }

    public Rules rules() {
        Map<String, Boolean> byKind = rules.findAll().stream().collect(Collectors.toMap(ApprovalRule::getKind, ApprovalRule::needsHr));
        Function<Kind, Boolean> needs = kind -> byKind.getOrDefault(kind.value, false);
        return new Rules(needs.apply(Kind.CORRECTION), needs.apply(Kind.HOME_DAY), needs.apply(Kind.COMP_OFF), needs.apply(Kind.OVERTIME));
    }

    @Transactional
    public Rules save(Rules changed) {
        Map<Kind, Boolean> wanted = Map.of(Kind.CORRECTION, changed.punchFixes(), Kind.HOME_DAY, changed.homeDays(), Kind.COMP_OFF, changed.compOff(),
                Kind.OVERTIME, changed.overtime());
        wanted.forEach((kind, needsHr) -> rules.findById(kind.value).orElseThrow().setNeedsHr(needsHr));
        return changed;
    }

    public boolean needsHr(Kind kind) {
        return rules.findById(kind.value).map(ApprovalRule::needsHr).orElse(false);
    }

    // Approving at the HOD step passes it to HR when the rule asks for it, unless the HOD is HR.
    public boolean passesToHr(Employee decider, boolean needsHr) {
        return needsHr && !decider.isHr();
    }

    // The HOD step can't decide what already waits for HR.
    public void checkHodStep(boolean isWaitingForHr) {
        if (isWaitingForHr) {
            throw new ApiException(HttpStatus.CONFLICT, "Their HOD approved this. It now waits for HR.");
        }
    }

    // HR decides only what waits for them, and never their own.
    public void checkHrStep(Employee hr, String employeeId, boolean isWaitingForHr) {
        if (!isWaitingForHr) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Nothing waiting for HR with that id");
        }
        if (hr.getId().equals(employeeId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Your own requests go to another HR person.");
        }
    }

    // Tells the person their HOD approved and HR is next, and asks everyone in HR but them.
    // what reads like "annual leave for Monday 7 December".
    public void passToHr(Employee hod, String employeeId, Notification.Kind kind, String what) {
        String name = people.namesOf(List.of(employeeId)).get(employeeId);
        notifications.tell(employeeId, kind, hod.getFullName() + " approved your " + what + ". It now waits for HR.");
        people.active().stream()
                .filter(Employee::isHr)
                .filter(hr -> !hr.getId().equals(employeeId))
                .forEach(hr -> notifications.tell(hr.getId(), Notification.Kind.APPROVAL, hod.getFullName() + " approved " + name + "'s " + what
                        + ". It needs HR too. Decide it from Inbox."));
    }
}
