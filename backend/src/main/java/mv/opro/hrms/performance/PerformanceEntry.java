package mv.opro.hrms.performance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// One entry in a section of someone's plan: a certification they aim for, something to learn, an accomplishment or a strength.
@Entity
public class PerformanceEntry {

    @Id
    private String id;

    private String cycleId;
    private String employeeId;
    private String section;
    private String title;
    private String details;
    private LocalDate targetOn;
    private int sortOrder;

    protected PerformanceEntry() {}

    PerformanceEntry(String id, String cycleId, String employeeId, String section, String title, String details, LocalDate targetOn, int sortOrder) {
        this.id = id;
        this.cycleId = cycleId;
        this.employeeId = employeeId;
        this.section = section;
        this.title = title;
        this.details = details;
        this.targetOn = targetOn;
        this.sortOrder = sortOrder;
    }

    public String getId() {
        return id;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public String getSection() {
        return section;
    }

    public String getTitle() {
        return title;
    }

    public String getDetails() {
        return details;
    }

    public LocalDate getTargetOn() {
        return targetOn;
    }
}
