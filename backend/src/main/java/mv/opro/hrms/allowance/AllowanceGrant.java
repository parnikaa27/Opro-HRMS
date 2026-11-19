package mv.opro.hrms.allowance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.math.BigDecimal;
import java.time.LocalDate;

// A one-off amount an HOD grants a report. HR approves it or declines with a reason.
@Entity
public class AllowanceGrant {

    static final String PENDING = "pending";
    static final String APPROVED = "approved";
    static final String REJECTED = "rejected";

    @Id
    private String id;

    private String employeeId;
    private String typeCode;
    private BigDecimal amount;
    private String currency;
    private String reason;
    private String status;
    private String grantedBy;
    private LocalDate grantedOn;
    private String decidedBy;
    private LocalDate decidedOn;
    private String decisionNote;

    protected AllowanceGrant() {}

    AllowanceGrant(String id, String employeeId, String typeCode, BigDecimal amount, String currency, String reason, String grantedBy, LocalDate grantedOn) {
        this.id = id;
        this.employeeId = employeeId;
        this.typeCode = typeCode;
        this.amount = amount;
        this.currency = currency;
        this.reason = reason;
        this.status = PENDING;
        this.grantedBy = grantedBy;
        this.grantedOn = grantedOn;
    }

    void decide(boolean isApproved, String by, LocalDate on, String note) {
        status = isApproved ? APPROVED : REJECTED;
        decidedBy = by;
        decidedOn = on;
        decisionNote = note;
    }

    boolean isPending() {
        return PENDING.equals(status);
    }

    public String getId() {
        return id;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public String getTypeCode() {
        return typeCode;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getCurrency() {
        return currency;
    }

    public String getReason() {
        return reason;
    }

    public String getStatus() {
        return status;
    }

    public String getGrantedBy() {
        return grantedBy;
    }

    public LocalDate getGrantedOn() {
        return grantedOn;
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
