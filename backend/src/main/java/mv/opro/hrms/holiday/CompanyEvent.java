package mv.opro.hrms.holiday;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// A company date on the calendar, like an office social.
@Entity
public class CompanyEvent {

    @Id
    private String id;

    private LocalDate eventDate;
    private String name;

    protected CompanyEvent() {}

    CompanyEvent(String id, LocalDate date, String name) {
        this.id = id;
        this.eventDate = date;
        this.name = name;
    }

    void update(LocalDate date, String name) {
        this.eventDate = date;
        this.name = name;
    }

    public String getId() {
        return id;
    }

    public LocalDate getEventDate() {
        return eventDate;
    }

    public String getName() {
        return name;
    }
}
