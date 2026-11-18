package mv.opro.hrms.attendance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.math.BigDecimal;
import java.time.LocalDate;

// A Friday or public holiday someone worked, waiting for their manager to give compensatory off for it.
@Entity
public class CompOffClaim {

    @Id
    private String id;

    private String employeeId;
    private LocalDate workDate;
    private String status;
    private BigDecimal days;
    private String decidedBy;
    private LocalDate decidedOn;
    private String decisionNote;
    private String hodApprovedBy;
    private LocalDate hodApprovedOn;

    protected CompOffClaim() {}

    CompOffClaim(String id, String employeeId, LocalDate workDate) {
        this.id = id;
        this.employeeId = employeeId;
        this.workDate = workDate;
        this.status = "pending";
    }

    void approve(BigDecimal earned, String by, LocalDate on) {
        status = "approved";
        days = earned;
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

    public BigDecimal getDays() {
        return days;
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

    // The HOD approved and HR is next. It stays pending until HR decides.
    void approveForHod(String by, LocalDate on) {
        hodApprovedBy = by;
        hodApprovedOn = on;
    }

    public boolean isWaitingForHr() {
        return isPending() && hodApprovedBy != null;
    }

    public String getHodApprovedBy() {
        return hodApprovedBy;
    }

    public LocalDate getHodApprovedOn() {
        return hodApprovedOn;
    }
}
