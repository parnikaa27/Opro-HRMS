package mv.opro.hrms.announcement;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// A short note from HR that everyone sees on their overview. HR writes them later.
@Entity
public class Announcement {

    @Id
    private String id;

    private String title;
    private String body;
    private LocalDate publishedOn;

    protected Announcement() {}

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public LocalDate getPublishedOn() {
        return publishedOn;
    }
}
