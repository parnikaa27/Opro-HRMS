package mv.opro.hrms.performance;

import java.time.LocalDate;
import java.util.Map;

// Someone's part of the open cycle: where their goals stand, and their self review. Field names match the frontend's AppraisalForm.
public record FormResponse(String goalsStatus, LocalDate goalsSubmittedOn, String hodApprovedByName, LocalDate hodApprovedOn, String goalsDecidedByName,
        LocalDate goalsDecidedOn, String goalsNote, String accomplishments, String strengths, String learning, String certifications,
        LocalDate selfReviewedOn) {

    // Nobody has started: draft, nothing written.
    static final FormResponse NOT_STARTED = new FormResponse(AppraisalForm.DRAFT, null, null, null, null, null, null, null, null, null, null, null);

    static FormResponse of(AppraisalForm form, Map<String, String> names) {
        if (form == null) {
            return NOT_STARTED;
        }
        AppraisalForm.SelfReview review = form.getSelfReview();
        return new FormResponse(form.getGoalsStatus(), form.getGoalsSubmittedOn(), form.getHodApprovedBy() == null ? null : names.get(form.getHodApprovedBy()),
                form.getHodApprovedOn(), form.getGoalsDecidedBy() == null ? null : names.get(form.getGoalsDecidedBy()), form.getGoalsDecidedOn(),
                form.getGoalsNote(), review.accomplishments(), review.strengths(), review.learning(), review.certifications(), form.getSelfReviewedOn());
    }
}
