package mv.opro.hrms.performance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.math.BigDecimal;
import java.time.LocalDate;

// The HOD's appraisal of one person in a cycle: an overall rating from 1 to 5, comments, and what they recommend.
// Final once saved. The person has to accept it.
@Entity
public class Appraisal {

    @Id
    private String id;

    private String cycleId;
    private String employeeId;
    private int rating;
    private String comments;
    private boolean recommendsPromotion;
    private BigDecimal incrementPercent;
    private String appraisedBy;
    private LocalDate appraisedOn;
    private LocalDate acceptedOn;
    private String selfReviewComment;

    protected Appraisal() {}

    Appraisal(String id, String cycleId, String employeeId, int rating, String comments, boolean recommendsPromotion, BigDecimal incrementPercent,
            String appraisedBy, LocalDate appraisedOn, String selfReviewComment) {
        this.id = id;
        this.cycleId = cycleId;
        this.employeeId = employeeId;
        this.rating = rating;
        this.comments = comments;
        this.recommendsPromotion = recommendsPromotion;
        this.incrementPercent = incrementPercent;
        this.appraisedBy = appraisedBy;
        this.appraisedOn = appraisedOn;
        this.selfReviewComment = selfReviewComment;
    }

    void accept(LocalDate on) {
        acceptedOn = on;
    }

    public String getId() {
        return id;
    }

    public String getCycleId() {
        return cycleId;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public int getRating() {
        return rating;
    }

    public String getComments() {
        return comments;
    }

    public boolean recommendsPromotion() {
        return recommendsPromotion;
    }

    public BigDecimal getIncrementPercent() {
        return incrementPercent;
    }

    public String getAppraisedBy() {
        return appraisedBy;
    }

    public LocalDate getAppraisedOn() {
        return appraisedOn;
    }

    public LocalDate getAcceptedOn() {
        return acceptedOn;
    }

    public String getSelfReviewComment() {
        return selfReviewComment;
    }
}
