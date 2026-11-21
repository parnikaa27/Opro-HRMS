package mv.opro.hrms.performance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// The HOD's decision before someone's probation ends.
@Entity
public class ProbationReview {

    @Id
    private String id;

    private String employeeId;
    private LocalDate probationEnded;
    private String outcome;
    private LocalDate extendedTo;
    private String comments;
    private String reviewedBy;
    private LocalDate reviewedOn;

    protected ProbationReview() {}

    ProbationReview(String id, String employeeId, LocalDate probationEnded, String outcome, LocalDate extendedTo, String comments, String reviewedBy,
            LocalDate reviewedOn) {
        this.id = id;
        this.employeeId = employeeId;
        this.probationEnded = probationEnded;
        this.outcome = outcome;
        this.extendedTo = extendedTo;
        this.comments = comments;
        this.reviewedBy = reviewedBy;
        this.reviewedOn = reviewedOn;
    }

    public String getId() {
        return id;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public LocalDate getProbationEnded() {
        return probationEnded;
    }

    public String getOutcome() {
        return outcome;
    }

    public LocalDate getExtendedTo() {
        return extendedTo;
    }

    public String getComments() {
        return comments;
    }

    public String getReviewedBy() {
        return reviewedBy;
    }

    public LocalDate getReviewedOn() {
        return reviewedOn;
    }
}
