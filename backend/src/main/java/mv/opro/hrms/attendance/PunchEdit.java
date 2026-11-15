package mv.opro.hrms.attendance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;
import java.time.LocalTime;

// One punch HR added or voided by hand, kept for good with who, when and why.
@Entity
public class PunchEdit {

    @Id
    private String id;

    private String employeeId;
    private LocalDate punchDate;
    private String action;
    private LocalTime punchTime;
    private String reason;
    private String madeBy;
    private LocalDate madeOn;

    protected PunchEdit() {}

    PunchEdit(String id, String employeeId, LocalDate punchDate, String action, LocalTime punchTime, String reason, String madeBy, LocalDate madeOn) {
        this.id = id;
        this.employeeId = employeeId;
        this.punchDate = punchDate;
        this.action = action;
        this.punchTime = punchTime;
        this.reason = reason;
        this.madeBy = madeBy;
        this.madeOn = madeOn;
    }

    public String getId() {
        return id;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public LocalDate getPunchDate() {
        return punchDate;
    }

    public String getAction() {
        return action;
    }

    public LocalTime getPunchTime() {
        return punchTime;
    }

    public String getReason() {
        return reason;
    }

    public String getMadeBy() {
        return madeBy;
    }

    public LocalDate getMadeOn() {
        return madeOn;
    }
}
