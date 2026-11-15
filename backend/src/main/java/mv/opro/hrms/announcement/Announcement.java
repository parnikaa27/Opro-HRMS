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

    Announcement(String id, String title, String body, LocalDate publishedOn) {
        this.id = id;
        this.title = title;
        this.body = body;
        this.publishedOn = publishedOn;
    }

    void update(String title, String body) {
        this.title = title;
        this.body = body;
    }

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
