package mv.opro.hrms.notification;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Tells people about things that concern them. Joins the caller's transaction, so a notification only exists
// if the change it describes was saved.
@Service
public class Notifications {

    private final NotificationRepository notifications;
    private final Clock clock;

    Notifications(NotificationRepository notifications, Clock clock) {
        this.notifications = notifications;
        this.clock = clock;
    }

    @Transactional
    public void tell(String employeeId, Notification.Kind kind, String text) {
        notifications.save(Notification.to(employeeId, kind, text, LocalDate.now(clock)));
    }

    @Transactional(readOnly = true)
    public List<Notification> of(String employeeId) {
        return notifications.findTop50ByEmployeeIdOrderByCreatedOnDescIdDesc(employeeId);
    }

    @Transactional
    public void markAllRead(String employeeId) {
        notifications.markAllRead(employeeId);
    }
}
