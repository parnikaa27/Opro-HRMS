package mv.opro.hrms.profile;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// HR's side of change requests: the inbox and its decisions.
@Service
public class ChangeRequests {

    private final ChangeRequestRepository requests;
    private final Notifications notifications;
    private final Clock clock;

    ChangeRequests(ChangeRequestRepository requests, Notifications notifications, Clock clock) {
        this.requests = requests;
        this.notifications = notifications;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ChangeRequest> all() {
        return requests.findAllByOrderByRaisedOnDescIdDesc();
    }

    @Transactional
    public ChangeRequest decide(Employee hr, String id, String decision, String note) {
        ChangeRequest request = requests.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No such change request"));
        if (!request.isOpen()) {
            throw new ApiException(HttpStatus.CONFLICT, "This request has already been handled.");
        }
        boolean isDone = "done".equals(decision);
        if (!isDone && (note == null || note.isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Say why, so they know what to do next.");
        }
        String cleanNote = note == null || note.isBlank() ? null : note.strip();
        request.decide(decision, hr.getId(), LocalDate.now(clock), cleanNote);
        String field = request.getField().toLowerCase();
        notifications.tell(request.getEmployeeId(), Notification.Kind.RECORD,
                isDone ? "HR updated your " + field + " as you asked." : "HR couldn't change your " + field + ": " + Wording.sentence(cleanNote));
        return request;
    }
}
