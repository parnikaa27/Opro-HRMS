package mv.opro.hrms.attendance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// A day someone worked from home. It counts straight away and waits for their manager. Declined, the day counts as absent.
@Entity
public class HomeDay {

    @Id
    private String id;

    private String employeeId;
    private LocalDate workDate;
    private String status;
    private String decidedBy;
    private LocalDate decidedOn;
    private String decisionNote;

    protected HomeDay() {}

    HomeDay(String id, String employeeId, LocalDate workDate) {
        this.id = id;
        this.employeeId = employeeId;
        this.workDate = workDate;
        this.status = "pending";
    }

    void decide(String decision, String by, LocalDate on, String note) {
        status = decision;
        decidedBy = by;
        decidedOn = on;
        decisionNote = note;
    }

    boolean isPending() {
        return "pending".equals(status);
    }

    public String getId() {
        return id;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public LocalDate getWorkDate() {
        return workDate;
    }

    public String getStatus() {
        return status;
    }

    public String getDecidedBy() {
        return decidedBy;
    }

    public LocalDate getDecidedOn() {
        return decidedOn;
    }

    public String getDecisionNote() {
        return decisionNote;
    }
}
