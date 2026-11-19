package mv.opro.hrms.document;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;
import java.util.Objects;

// One person's copy of one document type, with its files. An employee's upload waits for HR; HR's own uploads count as verified.
@Entity
public class EmployeeDocument {

    static final String PENDING = "pending";
    static final String VERIFIED = "verified";
    static final String REJECTED = "rejected";

    @Id
    private String id;

    private String employeeId;
    private String typeCode;
    private String status;
    private LocalDate updatedOn;
    private LocalDate expiresOn;
    private LocalDate issuedOn;
    private String uploadedBy;
    private String decidedBy;
    private LocalDate decidedOn;
    private String decisionNote;

    protected EmployeeDocument() {}

    EmployeeDocument(String id, String employeeId, String typeCode) {
        this.id = id;
        this.employeeId = employeeId;
        this.typeCode = typeCode;
    }

    // Same dates as now: another page of the same copy. Different ones: a new copy, whose files replace the old.
    boolean isSameCopy(LocalDate issued, LocalDate expires) {
        return Objects.equals(issuedOn, issued) && Objects.equals(expiresOn, expires);
    }

    // A new file waits for HR again, unless HR uploaded it.
    void upload(String by, LocalDate on, LocalDate issued, LocalDate expires, boolean isVerified) {
        uploadedBy = by;
        updatedOn = on;
        issuedOn = issued;
        expiresOn = expires;
        status = isVerified ? VERIFIED : PENDING;
        decidedBy = isVerified ? by : null;
        decidedOn = isVerified ? on : null;
        decisionNote = null;
    }

    void decide(String decision, String by, LocalDate on, String note) {
        status = decision;
        decidedBy = by;
        decidedOn = on;
        decisionNote = note;
    }

    boolean isPending() {
        return PENDING.equals(status);
    }

    boolean isVerified() {
        return VERIFIED.equals(status);
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

    public String getStatus() {
        return status;
    }

    public LocalDate getUpdatedOn() {
        return updatedOn;
    }

    public LocalDate getExpiresOn() {
        return expiresOn;
    }

    public LocalDate getIssuedOn() {
        return issuedOn;
    }

    public String getDecisionNote() {
        return decisionNote;
    }
}
