package mv.opro.hrms.announcement;

import java.time.LocalDate;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class AnnouncementController {

    record AnnouncementResponse(String id, String title, String body, LocalDate publishedOn) {}

    private final AnnouncementRepository announcements;

    AnnouncementController(AnnouncementRepository announcements) {
        this.announcements = announcements;
    }

    @GetMapping("/api/announcements")
    List<AnnouncementResponse> all() {
        return announcements.findAllByOrderByPublishedOnDescIdDesc().stream()
                .map(note -> new AnnouncementResponse(note.getId(), note.getTitle(), note.getBody(), note.getPublishedOn()))
                .toList();
    }
}
