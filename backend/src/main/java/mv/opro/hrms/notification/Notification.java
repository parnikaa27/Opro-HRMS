package mv.opro.hrms.notification;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.LocalDate;

@Entity
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String employeeId;
    private String kind;
    private String text;
    private LocalDate createdOn;
    private boolean isRead;

    protected Notification() {}

    static Notification to(String employeeId, Kind kind, String text, LocalDate today) {
        Notification notification = new Notification();
        notification.employeeId = employeeId;
        notification.kind = kind.value;
        notification.text = text;
        notification.createdOn = today;
        return notification;
    }

    public Long getId() {
        return id;
    }

    public String getKind() {
        return kind;
    }

    public String getText() {
        return text;
    }

    public LocalDate getCreatedOn() {
        return createdOn;
    }

    public boolean isRead() {
        return isRead;
    }

    // The kinds the frontend gives a title to. Same values as the database check.
    public enum Kind {
        APPROVAL("approval"),
        LEAVE("leave"),
        VISA("visa"),
        CORRECTION("correction"),
        HOLIDAY("holiday"),
        ANNOUNCEMENT("announcement"),
        RECORD("record"),
        SCHEDULE("schedule"),
        HOME("home"),
        FLIGHT("flight"),
        OVERTIME("overtime");

        private final String value;

        Kind(String value) {
            this.value = value;
        }
    }
}
