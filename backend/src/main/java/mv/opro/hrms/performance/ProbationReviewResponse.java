package mv.opro.hrms.performance;

import java.time.LocalDate;
import java.util.Map;

// Field names match the frontend's ProbationReview.
public record ProbationReviewResponse(String id, String employeeId, String employeeName, LocalDate probationEnded, String outcome, LocalDate extendedTo,
        String comments, String reviewedByName, LocalDate reviewedOn) {

    static ProbationReviewResponse of(ProbationReview review, Map<String, String> names) {
        return new ProbationReviewResponse(review.getId(), review.getEmployeeId(), names.get(review.getEmployeeId()), review.getProbationEnded(),
                review.getOutcome(), review.getExtendedTo(), review.getComments(), names.get(review.getReviewedBy()), review.getReviewedOn());
    }
}
