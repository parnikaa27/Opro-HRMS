package mv.opro.hrms.attendance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

// A day off worked, as the approvals page shows it. days is what it earns: decided, or what approving would give.
// Field names match the frontend's CompOffClaim.
public record CompOffResponse(String id, String employeeId, String employeeName, LocalDate date, String status, BigDecimal days, long workedMinutes,
        String decidedBy, String decidedByName, LocalDate decidedOn, String decisionNote) {

    public static CompOffResponse of(CompOffs.Claim claim, Map<String, String> names) {
        CompOffClaim found = claim.claim();
        return new CompOffResponse(found.getId(), found.getEmployeeId(), names.get(found.getEmployeeId()), found.getWorkDate(), found.getStatus(),
                claim.days(), claim.workedMinutes(), found.getDecidedBy(), found.getDecidedBy() == null ? null : names.get(found.getDecidedBy()),
                found.getDecidedOn(), found.getDecisionNote());
    }
}
