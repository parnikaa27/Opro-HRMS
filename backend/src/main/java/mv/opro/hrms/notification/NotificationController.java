package mv.opro.hrms.notification;

import java.time.LocalDate;
import java.util.List;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Notifications", description = "Your own notifications.")
@RestController
class NotificationController {

    record NotificationResponse(String id, String kind, String text, LocalDate createdOn, boolean isRead) {}

    private final Notifications notifications;
    private final CurrentUser currentUser;

    NotificationController(Notifications notifications, CurrentUser currentUser) {
        this.notifications = notifications;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/notifications")
    List<NotificationResponse> mine() {
        return notifications.of(currentUser.get().getId()).stream()
                .map(each -> new NotificationResponse("NT-" + each.getId(), each.getKind(), each.getText(), each.getCreatedOn(), each.isRead()))
                .toList();
    }

    @PostMapping("/api/notifications/read")
    ResponseEntity<Void> markAllRead() {
        notifications.markAllRead(currentUser.get().getId());
        return ResponseEntity.noContent().build();
    }
}
