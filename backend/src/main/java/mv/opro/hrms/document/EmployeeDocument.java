package mv.opro.hrms.document;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;
import java.util.UUID;

// One person's copy of one document type. An employee's upload waits for HR; HR's own uploads count as verified.
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
    private UUID fileId;
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

    // A new file replaces the old one. Returns the old one so it can go.
    UUID upload(UUID file, String by, LocalDate on, LocalDate expires, boolean isVerified) {
        UUID previous = fileId;
        fileId = file;
        uploadedBy = by;
        updatedOn = on;
        expiresOn = expires;
        status = isVerified ? VERIFIED : PENDING;
        decidedBy = isVerified ? by : null;
        decidedOn = isVerified ? on : null;
        decisionNote = null;
        return previous;
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

    public UUID getFileId() {
        return fileId;
    }

    public String getDecisionNote() {
        return decisionNote;
    }
}
