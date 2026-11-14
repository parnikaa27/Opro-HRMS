package mv.opro.hrms.attendance;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Punch fix requests: raised by the employee, decided by their manager (later HR too).
@Service
@Transactional(readOnly = true)
public class Corrections {

    private static final String APPROVED = "approved";

    public record Decision(String decision, String note) {}

    private final CorrectionRequestRepository corrections;
    private final PunchRepository punches;
    private final Notifications notifications;
    private final Clock clock;

    Corrections(CorrectionRequestRepository corrections, PunchRepository punches, Notifications notifications, Clock clock) {
        this.corrections = corrections;
        this.punches = punches;
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

    @Transactional
    public CorrectionRequest raise(Employee employee, LocalDate date, String kind, LocalTime time, String reason) {
        LocalDate today = LocalDate.now(clock);
        if (date.isAfter(today)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You can't fix a day that hasn't happened yet.");
        }
        if (date.isBefore(employee.getJoinedOn())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "That's before you joined.");
        }
        CorrectionRequest request = corrections.save(CorrectionRequest.raise(Ids.next("AC"), employee.getId(), date, kind, time, reason.strip(), today));
        if (employee.getManagerId() != null) {
            notifications.tell(employee.getManagerId(), Notification.Kind.APPROVAL,
                    employee.getFullName() + " asked for a punch fix " + Wording.when(date, date));
        }
        return request;
    }

    // An approved fix adds the punch it asked for, linked back to the request. Declining needs a reason.
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
        request.decide(decision.decision(), decider.getId(), LocalDate.now(clock), note);
        if (isApproved) {
            OffsetDateTime at = request.getPunchDate().atTime(request.getRequestedTime()).atZone(clock.getZone()).toOffsetDateTime();
            // The punch may already be there, if the device caught up. Then there is nothing to add.
            if (!punches.existsByEmployeeIdAndPunchedAt(request.getEmployeeId(), at)) {
                punches.save(Punch.fromApprovedFix(request.getEmployeeId(), at, request.getId()));
            }
        }
        String day = Wording.date(request.getPunchDate());
        notifications.tell(request.getEmployeeId(), Notification.Kind.CORRECTION, isApproved
                ? "Your punch fix for " + day + " was approved. The " + Wording.time(request.getRequestedTime()) + " punch is now on your record."
                : "Your punch fix for " + day + " was declined: " + Wording.sentence(note));
        return request;
    }
}
