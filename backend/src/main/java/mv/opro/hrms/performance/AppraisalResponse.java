package mv.opro.hrms.performance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

// An appraisal with the goals it rated. Field names match the frontend's Appraisal.
// The recommendations are the HOD's advice to HR, so the person's own view leaves them out.
public record AppraisalResponse(String id, String cycleId, String cycleName, String employeeId, int rating, String comments, Boolean recommendsPromotion,
        BigDecimal incrementPercent, String appraisedByName, LocalDate appraisedOn, LocalDate acknowledgedOn, List<GoalResponse> goals) {

    static AppraisalResponse of(Appraisal appraisal, String cycleName, String appraisedByName, List<Goal> goals) {
        return new AppraisalResponse(appraisal.getId(), appraisal.getCycleId(), cycleName, appraisal.getEmployeeId(), appraisal.getRating(),
                appraisal.getComments(), appraisal.recommendsPromotion(), appraisal.getIncrementPercent(), appraisedByName, appraisal.getAppraisedOn(),
                appraisal.getAcknowledgedOn(), goals.stream().map(GoalResponse::of).toList());
    }

    AppraisalResponse withoutRecommendations() {
        return new AppraisalResponse(id, cycleId, cycleName, employeeId, rating, comments, null, null, appraisedByName, appraisedOn, acknowledgedOn, goals);
    }
}
