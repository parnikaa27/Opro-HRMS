package mv.opro.hrms.announcement;

import java.time.Clock;
import java.time.LocalDate;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// HR posts, edits and takes down announcements. Only a new one tells everyone.
@Service
public class AnnouncementEditor {

    private final AnnouncementRepository announcements;
    private final Notifications notifications;
    private final Clock clock;

    AnnouncementEditor(AnnouncementRepository announcements, Notifications notifications, Clock clock) {
        this.announcements = announcements;
        this.notifications = notifications;
        this.clock = clock;
    }

    @Transactional
    public Announcement post(String title, String body) {
        Announcement note = announcements.save(new Announcement(Ids.next("AN"), title.strip(), body.strip(), LocalDate.now(clock)));
        notifications.tellEveryone(Notification.Kind.ANNOUNCEMENT, note.getTitle());
        return note;
    }

    @Transactional
    public Announcement update(String id, String title, String body) {
        Announcement note = find(id);
        note.update(title.strip(), body.strip());
        return note;
    }

    @Transactional
    public void delete(String id) {
        announcements.delete(find(id));
    }

    private Announcement find(String id) {
        return announcements.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No such announcement"));
    }
}
