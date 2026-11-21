package mv.opro.hrms.performance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// One person's part of a cycle: the goals they write, approved by their HOD and then HR, and their self review.
@Entity
public class AppraisalForm {

    static final String DRAFT = "draft";
    static final String SUBMITTED = "submitted";
    static final String HOD_APPROVED = "hod-approved";
    static final String APPROVED = "approved";
    static final String REJECTED = "rejected";

    // What the person writes about their year. Each part is optional.
    public record SelfReview(String accomplishments, String strengths, String learning, String certifications) {}

    @Id
    private String id;

    private String cycleId;
    private String employeeId;
    private String goalsStatus;
    private LocalDate goalsSubmittedOn;
    private String hodApprovedBy;
    private LocalDate hodApprovedOn;
    private String goalsDecidedBy;
    private LocalDate goalsDecidedOn;
    private String goalsNote;
    private String accomplishments;
    private String strengths;
    private String learning;
    private String certifications;
    private LocalDate selfReviewedOn;

    protected AppraisalForm() {}

    AppraisalForm(String id, String cycleId, String employeeId) {
        this.id = id;
        this.cycleId = cycleId;
        this.employeeId = employeeId;
        this.goalsStatus = DRAFT;
    }

    // Draft, or sent back: theirs to change.
    boolean canEditGoals() {
        return DRAFT.equals(goalsStatus) || REJECTED.equals(goalsStatus);
    }

    void submitGoals(LocalDate on) {
        goalsStatus = SUBMITTED;
        goalsSubmittedOn = on;
        hodApprovedBy = null;
        hodApprovedOn = null;
        goalsDecidedBy = null;
        goalsDecidedOn = null;
        goalsNote = null;
    }

    void approveForHod(String by, LocalDate on) {
        goalsStatus = HOD_APPROVED;
        hodApprovedBy = by;
        hodApprovedOn = on;
    }

    void decideGoals(boolean isApproved, String by, LocalDate on, String note) {
        goalsStatus = isApproved ? APPROVED : REJECTED;
        goalsDecidedBy = by;
        goalsDecidedOn = on;
        goalsNote = note;
    }

    void review(SelfReview review, LocalDate on) {
        accomplishments = review.accomplishments();
        strengths = review.strengths();
        learning = review.learning();
        certifications = review.certifications();
        selfReviewedOn = on;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public String getGoalsStatus() {
        return goalsStatus;
    }

    public LocalDate getGoalsSubmittedOn() {
        return goalsSubmittedOn;
    }

    public String getHodApprovedBy() {
        return hodApprovedBy;
    }

    public LocalDate getHodApprovedOn() {
        return hodApprovedOn;
    }

    public String getGoalsDecidedBy() {
        return goalsDecidedBy;
    }

    public LocalDate getGoalsDecidedOn() {
        return goalsDecidedOn;
    }

    public String getGoalsNote() {
        return goalsNote;
    }

    public SelfReview getSelfReview() {
        return new SelfReview(accomplishments, strengths, learning, certifications);
    }

    public LocalDate getSelfReviewedOn() {
        return selfReviewedOn;
    }
}
