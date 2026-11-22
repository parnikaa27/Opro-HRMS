package mv.opro.hrms.performance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// One person's plan for a cycle: their goals and the four other sections, sent together to their HOD and then HR.
@Entity
public class AppraisalForm {

    static final String DRAFT = "draft";
    static final String SUBMITTED = "submitted";
    static final String HOD_APPROVED = "hod-approved";
    static final String APPROVED = "approved";
    static final String REJECTED = "rejected";

    @Id
    private String id;

    private String cycleId;
    private String employeeId;
    private String status;
    private LocalDate submittedOn;
    private String hodApprovedBy;
    private LocalDate hodApprovedOn;
    private String decidedBy;
    private LocalDate decidedOn;
    private String note;

    protected AppraisalForm() {}

    AppraisalForm(String id, String cycleId, String employeeId) {
        this.id = id;
        this.cycleId = cycleId;
        this.employeeId = employeeId;
        this.status = DRAFT;
    }

    // Draft, or sent back: theirs to change.
    boolean canEdit() {
        return DRAFT.equals(status) || REJECTED.equals(status);
    }

    void submit(LocalDate on) {
        status = SUBMITTED;
        submittedOn = on;
        hodApprovedBy = null;
        hodApprovedOn = null;
        decidedBy = null;
        decidedOn = null;
        note = null;
    }

    void approveForHod(String by, LocalDate on) {
        status = HOD_APPROVED;
        hodApprovedBy = by;
        hodApprovedOn = on;
    }

    void decide(boolean isApproved, String by, LocalDate on, String reason) {
        status = isApproved ? APPROVED : REJECTED;
        decidedBy = by;
        decidedOn = on;
        note = reason;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public String getStatus() {
        return status;
    }

    public LocalDate getSubmittedOn() {
        return submittedOn;
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

    public String getNote() {
        return note;
    }
}
