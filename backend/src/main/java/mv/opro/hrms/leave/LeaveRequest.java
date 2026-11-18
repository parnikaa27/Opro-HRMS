package mv.opro.hrms.leave;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
public class LeaveRequest {

    static final String PENDING = "pending";
    static final String APPROVED = "approved";
    static final String CANCELLED = "cancelled";

    @Id
    private String id;

    private String employeeId;
    private String type;

    private LocalDate fromDate;
    private LocalDate toDate;

    private String halfDay;
    private BigDecimal days;
    private String reason;
    private String status;
    private LocalDate appliedOn;
    private String decidedBy;
    private LocalDate decidedOn;
    private String decisionNote;
    private String hodApprovedBy;
    private LocalDate hodApprovedOn;
    private boolean hasCertificate;
    private UUID certificateFileId;

    protected LeaveRequest() {}

    static LeaveRequest apply(String id, String employeeId, String type, LocalDate from, LocalDate to, String halfDay, BigDecimal days,
            String reason, LocalDate today) {
        LeaveRequest request = new LeaveRequest();
        request.id = id;
        request.employeeId = employeeId;
        request.type = type;
        request.fromDate = from;
        request.toDate = to;
        request.halfDay = halfDay;
        request.days = days;
        request.reason = reason;
        request.status = PENDING;
        request.appliedOn = today;
        return request;
    }

    // Pending can always be withdrawn. Approved only while it hasn't started.
    boolean canBeCancelledOn(LocalDate today) {
        return PENDING.equals(status) || (APPROVED.equals(status) && fromDate.isAfter(today));
    }

    void cancel() {
        status = CANCELLED;
    }

    void decide(String decision, String by, LocalDate on, String note) {
        status = decision;
        decidedBy = by;
        decidedOn = on;
        decisionNote = note;
    }

    // Health data on a sick leave request. Returns the file it replaces, if any.
    UUID attachCertificate(UUID fileId) {
        UUID previous = certificateFileId;
        certificateFileId = fileId;
        hasCertificate = true;
        return previous;
    }

    boolean acceptsCertificate() {
        return "sick".equals(type) && (PENDING.equals(status) || APPROVED.equals(status));
    }

    public UUID getCertificateFileId() {
        return certificateFileId;
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

    public String getType() {
        return type;
    }

    public LocalDate getFromDate() {
        return fromDate;
    }

    public LocalDate getToDate() {
        return toDate;
    }

    public String getHalfDay() {
        return halfDay;
    }

    public BigDecimal getDays() {
        return days;
    }

    public String getReason() {
        return reason;
    }

    public String getStatus() {
        return status;
    }

    public LocalDate getAppliedOn() {
        return appliedOn;
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

    public boolean hasCertificate() {
        return hasCertificate;
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
