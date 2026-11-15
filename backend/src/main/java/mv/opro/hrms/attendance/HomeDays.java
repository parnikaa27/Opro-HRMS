package mv.opro.hrms.attendance;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Days worked from home: listed for the manager and decided by them.
@Service
@Transactional(readOnly = true)
public class HomeDays {

    private static final String APPROVED = "approved";

    private final HomeDayRepository days;
    private final Notifications notifications;
    private final Clock clock;

    HomeDays(HomeDayRepository days, Notifications notifications, Clock clock) {
        this.days = days;
        this.notifications = notifications;
        this.clock = clock;
    }

    public List<HomeDay> of(Collection<String> employeeIds, String status) {
        return status == null ? days.findByEmployeeIdInOrderByWorkDateDesc(employeeIds) : days.findByEmployeeIdInAndStatusOrderByWorkDateDesc(employeeIds, status);
    }

    // Declining needs a reason, since it turns the day into an absence.
    @Transactional
    public HomeDay decide(Employee decider, String id, Collection<String> inScope, Corrections.Decision decision) {
        HomeDay day = days.findById(id).filter(found -> inScope.contains(found.getEmployeeId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Day not found"));
        if (!day.isPending()) {
            throw new ApiException(HttpStatus.CONFLICT, "This day has already been decided.");
        }
        String note = decision.note() == null || decision.note().isBlank() ? null : decision.note().strip();
        boolean isApproved = APPROVED.equals(decision.decision());
        if (!isApproved && note == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Give a short reason. Declining makes the day an absence.");
        }
        day.decide(decision.decision(), decider.getId(), LocalDate.now(clock), note);
        String date = Wording.date(day.getWorkDate());
        notifications.tell(day.getEmployeeId(), Notification.Kind.HOME, isApproved
                ? decider.getFullName() + " approved working from home on " + date + "."
                : decider.getFullName() + " didn't approve working from home on " + date + ", so it counts as absent: " + Wording.sentence(note));
        return day;
    }
}
