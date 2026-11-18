package mv.opro.hrms.hr;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// One expatriate quota approval from the Ministry: slots for a job category, until a date.
@Entity
class QuotaApproval {

    @Id
    private String id;

    private String jobCategory;
    private int slots;
    private String approvalNumber;
    private LocalDate approvedOn;
    private LocalDate expiresOn;

    protected QuotaApproval() {}

    QuotaApproval(String id) {
        this.id = id;
    }

    record Terms(String jobCategory, int slots, String approvalNumber, LocalDate approvedOn, LocalDate expiresOn) {}

    void change(Terms terms) {
        jobCategory = terms.jobCategory();
        slots = terms.slots();
        approvalNumber = terms.approvalNumber();
        approvedOn = terms.approvedOn();
        expiresOn = terms.expiresOn();
    }

    String getId() {
        return id;
    }

    String getJobCategory() {
        return jobCategory;
    }

    int getSlots() {
        return slots;
    }

    String getApprovalNumber() {
        return approvalNumber;
    }

    LocalDate getApprovedOn() {
        return approvedOn;
    }

    LocalDate getExpiresOn() {
        return expiresOn;
    }
}
