package mv.opro.hrms.attendance;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Punch fix requests: raised by the employee, decided by their manager. A super admin's are approved as they're raised.
// A fixed day that now shows overtime asks the HOD about it.
@Service
@Transactional(readOnly = true)
public class Corrections {

    private static final String APPROVED = "approved";
    private static final String LATE = "late";
    private static final String MISSED_IN = "missed-in";
    private static final Set<String> NEEDS_REASON = Set.of(LATE, "other");
    private static final Map<String, String> CATEGORY_NAMES = Map.of("resort", "working from a resort", "forgot", "forgot to punch", LATE, "late punch",
            "other", "other");

    public record Decision(String decision, String note) {}

    private final CorrectionRequestRepository corrections;
    private final PunchRepository punches;
    private final Overtimes overtimes;
    private final Notifications notifications;
    private final Clock clock;

    Corrections(CorrectionRequestRepository corrections, PunchRepository punches, Overtimes overtimes, Notifications notifications, Clock clock) {
        this.corrections = corrections;
        this.punches = punches;
        this.overtimes = overtimes;
        this.notifications = notifications;
        this.clock = clock;
    }

    public List<CorrectionRequest> of(String employeeId) {
        return corrections.findByEmployeeIdOrderByRaisedOnDescPunchDateDesc(employeeId);
    }

    public List<CorrectionRequest> of(Collection<String> employeeIds, String status) {
        return status == null
                ? corrections.findByEmployeeIdInOrderByRaisedOnDesc(employeeIds)
                : corrections.findByEmployeeIdInAndStatusOrderByRaisedOnDesc(employeeIds, status);
    }

    // Working from a resort and forgetting to punch speak for themselves. A late punch and anything else need a reason.
    @Transactional
    public CorrectionRequest raise(Employee employee, LocalDate date, String kind, String category, LocalTime time, String reason) {
        LocalDate today = LocalDate.now(clock);
        String cleanReason = reason == null || reason.isBlank() ? null : reason.strip();
        if (cleanReason == null && NEEDS_REASON.contains(category)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Say what happened, so your manager can check it.");
        }
        if (LATE.equals(category) && !MISSED_IN.equals(kind)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "A late punch is about your punch in.");
        }
        if (date.isAfter(today)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You can't fix a day that hasn't happened yet.");
        }
        if (date.isBefore(employee.getJoinedOn())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "That's before you joined.");
        }
        CorrectionRequest request = corrections.save(CorrectionRequest.raise(Ids.next("AC"), employee.getId(), date, kind, category, time, cleanReason, today));
        if (employee.isSuperAdmin()) {
            approve(employee, request);
        } else if (employee.getManagerId() != null) {
            notifications.tell(employee.getManagerId(), Notification.Kind.APPROVAL,
                    employee.getFullName() + " asked for a punch fix (" + CATEGORY_NAMES.get(category) + ") " + Wording.when(date, date));
        }
        return request;
    }

    // An approved fix adds the punch it asked for, linked back to the request. A late punch replaces their punch in instead:
    // the late one is voided, never deleted. Declining needs a reason.
    @Transactional
    public CorrectionRequest decide(Employee decider, String id, Collection<String> inScope, Decision decision) {
        CorrectionRequest request = corrections.findById(id)
                .filter(found -> inScope.contains(found.getEmployeeId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Request not found"));
        if (!request.isPending()) {
            throw new ApiException(HttpStatus.CONFLICT, "This request has already been decided.");
        }
        String note = decision.note() == null || decision.note().isBlank() ? null : decision.note().strip();
        boolean isApproved = APPROVED.equals(decision.decision());
        if (!isApproved && note == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Give a short reason so they know what to do next.");
        }
        if (isApproved) {
            approve(decider, request);
        } else {
            request.decide(decision.decision(), decider.getId(), LocalDate.now(clock), note);
        }
        String day = Wording.date(request.getPunchDate());
        notifications.tell(request.getEmployeeId(), Notification.Kind.CORRECTION, isApproved
                ? "Your punch fix for " + day + " was approved. The " + Wording.time(request.getRequestedTime()) + " punch is now on your record."
                : "Your punch fix for " + day + " was declined: " + Wording.sentence(note));
        return request;
    }

    private void approve(Employee decider, CorrectionRequest request) {
        OffsetDateTime at = request.getPunchDate().atTime(request.getRequestedTime()).atZone(clock.getZone()).toOffsetDateTime();
        if (request.isLatePunch()) {
            voidLatePunchIn(decider, request, at);
        }
        request.decide(APPROVED, decider.getId(), LocalDate.now(clock), null);
        // The punch may already be there. Then there is nothing to add.
        if (!punches.existsByEmployeeIdAndPunchedAt(request.getEmployeeId(), at)) {
            punches.save(Punch.fromApprovedFix(request.getEmployeeId(), at, request.getId()));
        }
        overtimes.raise(request.getEmployeeId(), request.getPunchDate());
    }

    // Their first punch that day, if it came after the time they say they arrived.
    private void voidLatePunchIn(Employee decider, CorrectionRequest request, OffsetDateTime arrived) {
        ZoneId zone = clock.getZone();
        LocalDate day = request.getPunchDate();
        punches.findByEmployeeIdAndPunchedAtGreaterThanEqualAndPunchedAtLessThanOrderByPunchedAt(request.getEmployeeId(),
                        day.atStartOfDay(zone).toOffsetDateTime(), day.plusDays(1).atStartOfDay(zone).toOffsetDateTime()).stream()
                .filter(punch -> !punch.isVoided())
                .findFirst()
                .ifPresent(first -> {
                    if (!first.getPunchedAt().isAfter(arrived)) {
                        throw new ApiException(HttpStatus.CONFLICT, "Their punch in that day is already at " + Wording.time(first.getPunchedAt()
                                .atZoneSameInstant(zone).toLocalTime()) + ", no later than the time they gave.");
                    }
                    first.voidBy(decider.getId(), OffsetDateTime.now(clock));
                });
    }
}
