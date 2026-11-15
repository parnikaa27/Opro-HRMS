package mv.opro.hrms.attendance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;
import java.time.LocalTime;

// Someone asking for a missed punch to be added. Approving it is the manager's step, later.
@Entity
public class CorrectionRequest {

    @Id
    private String id;

    private String employeeId;
    private LocalDate punchDate;
    private String kind;
    private LocalTime requestedTime;
    private String reason;
    private String status;
    private LocalDate raisedOn;
    private String decidedBy;
    private LocalDate decidedOn;
    private String decisionNote;

    protected CorrectionRequest() {}

    static CorrectionRequest raise(String id, String employeeId, LocalDate punchDate, String kind, LocalTime requestedTime, String reason, LocalDate today) {
        CorrectionRequest request = new CorrectionRequest();
        request.id = id;
        request.employeeId = employeeId;
        request.punchDate = punchDate;
        request.kind = kind;
        request.requestedTime = requestedTime;
        request.reason = reason;
        request.status = "pending";
        request.raisedOn = today;
        return request;
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

    public LocalDate getPunchDate() {
        return punchDate;
    }

    public String getKind() {
        return kind;
    }

    public LocalTime getRequestedTime() {
        return requestedTime;
    }

    public String getReason() {
        return reason;
    }

    public String getStatus() {
        return status;
    }

    public LocalDate getRaisedOn() {
        return raisedOn;
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
