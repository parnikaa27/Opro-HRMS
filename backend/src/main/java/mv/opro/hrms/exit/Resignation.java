package mv.opro.hrms.exit;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// Someone resigning. Their HOD approves, then HR, who sets the exit date. Declining needs a reason at either step.
@Entity
public class Resignation {

    static final String PENDING = "pending";
    static final String APPROVED = "approved";
    static final String REJECTED = "rejected";
    static final String WITHDRAWN = "withdrawn";

    @Id
    private String id;

    private String employeeId;
    private LocalDate submittedOn;
    private String reason;
    private LocalDate releaseOn;
    private String status;
    private String hodApprovedBy;
    private LocalDate hodApprovedOn;
    private String decidedBy;
    private LocalDate decidedOn;
    private String decisionNote;
    private LocalDate exitOn;

    protected Resignation() {}

    Resignation(String id, String employeeId, LocalDate submittedOn, String reason, LocalDate releaseOn) {
        this.id = id;
        this.employeeId = employeeId;
        this.submittedOn = submittedOn;
        this.reason = reason;
        this.releaseOn = releaseOn;
        this.status = PENDING;
    }

    // by is null when there was no HOD to ask.
    void approveForHod(String by, LocalDate on) {
        hodApprovedBy = by;
        hodApprovedOn = on;
    }

    void approve(String by, LocalDate on, LocalDate exit) {
        status = APPROVED;
        decidedBy = by;
        decidedOn = on;
        exitOn = exit;
    }

    void reject(String by, LocalDate on, String note) {
        status = REJECTED;
        decidedBy = by;
        decidedOn = on;
        decisionNote = note;
    }

    void withdraw(LocalDate on) {
        status = WITHDRAWN;
        decidedOn = on;
    }

    boolean isPending() {
        return PENDING.equals(status);
    }

    boolean isApproved() {
        return APPROVED.equals(status);
    }

    public boolean isWaitingForHr() {
        return isPending() && hodApprovedOn != null;
    }

    public String getId() {
        return id;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public LocalDate getSubmittedOn() {
        return submittedOn;
    }

    public String getReason() {
        return reason;
    }

    public LocalDate getReleaseOn() {
        return releaseOn;
    }

    public String getStatus() {
        return status;
    }

    public String getHodApprovedBy() {
        return hodApprovedBy;
    }

    public LocalDate getHodApprovedOn() {
        return hodApprovedOn;
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

    public LocalDate getExitOn() {
        return exitOn;
    }
}
