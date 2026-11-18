package mv.opro.hrms.attendance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// A working day someone stayed past the shift, waiting for their HOD. minutes is what was approved, for payroll.
@Entity
public class OvertimeClaim {

    @Id
    private String id;

    private String employeeId;
    private LocalDate workDate;
    private String status;
    private Integer minutes;
    private String decidedBy;
    private LocalDate decidedOn;
    private String decisionNote;

    protected OvertimeClaim() {}

    OvertimeClaim(String id, String employeeId, LocalDate workDate) {
        this.id = id;
        this.employeeId = employeeId;
        this.workDate = workDate;
        this.status = "pending";
    }

    void approve(int approved, String by, LocalDate on) {
        status = "approved";
        minutes = approved;
        decidedBy = by;
        decidedOn = on;
    }

    void reject(String by, LocalDate on, String note) {
        status = "rejected";
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

    public Integer getMinutes() {
        return minutes;
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
