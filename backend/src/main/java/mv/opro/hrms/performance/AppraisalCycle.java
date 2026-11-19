package mv.opro.hrms.performance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// A round of appraisals HR opens for everyone, "2026 appraisals" due 31 January, say. One is open at a time.
@Entity
public class AppraisalCycle {

    @Id
    private String id;

    private String name;
    private LocalDate dueOn;
    private String openedBy;
    private LocalDate openedOn;
    private LocalDate closedOn;

    protected AppraisalCycle() {}

    AppraisalCycle(String id, String name, LocalDate dueOn, String openedBy, LocalDate openedOn) {
        this.id = id;
        this.name = name;
        this.dueOn = dueOn;
        this.openedBy = openedBy;
        this.openedOn = openedOn;
    }

    void close(LocalDate on) {
        closedOn = on;
    }

    boolean isOpen() {
        return closedOn == null;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public LocalDate getDueOn() {
        return dueOn;
    }

    public LocalDate getOpenedOn() {
        return openedOn;
    }

    public LocalDate getClosedOn() {
        return closedOn;
    }
}
