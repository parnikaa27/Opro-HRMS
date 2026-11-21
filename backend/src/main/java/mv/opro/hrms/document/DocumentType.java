package mv.opro.hrms.document;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// A document Opro keeps for each person, from HR's list. uploadedBy says who sends it in: the employee, or HR.
@Entity
public class DocumentType {

    static final String EMPLOYEE = "employee";

    @Id
    private String code;

    private String name;
    private String uploadedBy;
    private boolean hasExpiry;
    private boolean forExpatriatesOnly;
    private int sortOrder;
    private LocalDate retiredOn;
    private int remindDaysBefore;
    private boolean isForEveryone;

    protected DocumentType() {}

    // remindDaysBefore: how long before expiry the person and HR hear. isForEveryone false: only people HR asks.
    public record Rules(String name, String uploadedBy, boolean hasExpiry, boolean forExpatriatesOnly, int remindDaysBefore, boolean isForEveryone) {}

    DocumentType(String code, int sortOrder, Rules rules) {
        this.code = code;
        this.sortOrder = sortOrder;
        change(rules);
    }

    void change(Rules rules) {
        name = rules.name().strip();
        uploadedBy = rules.uploadedBy();
        hasExpiry = rules.hasExpiry();
        forExpatriatesOnly = rules.forExpatriatesOnly();
        remindDaysBefore = rules.remindDaysBefore();
        isForEveryone = rules.isForEveryone();
    }

    void retire(LocalDate on) {
        retiredOn = on;
    }

    boolean isRetired() {
        return retiredOn != null;
    }

    boolean isUploadedByEmployee() {
        return EMPLOYEE.equals(uploadedBy);
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public String getUploadedBy() {
        return uploadedBy;
    }

    public boolean hasExpiry() {
        return hasExpiry;
    }

    public boolean isForExpatriatesOnly() {
        return forExpatriatesOnly;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public LocalDate getRetiredOn() {
        return retiredOn;
    }

    public int getRemindDaysBefore() {
        return remindDaysBefore;
    }

    public boolean isForEveryone() {
        return isForEveryone;
    }
}
