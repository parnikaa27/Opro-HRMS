package mv.opro.hrms.attendance;

import java.time.LocalDate;
import java.util.Map;

// Overtime as the approvals page shows it. minutes is what was approved, or what the punches show now.
// Field names match the frontend's OvertimeClaim.
public record OvertimeResponse(String id, String employeeId, String employeeName, LocalDate date, String status, long minutes, String decidedBy,
        String decidedByName, LocalDate decidedOn, String decisionNote, String hodApprovedByName, LocalDate hodApprovedOn) {

    public static OvertimeResponse of(Overtimes.Claim claim, Map<String, String> names) {
        OvertimeClaim found = claim.claim();
        return new OvertimeResponse(found.getId(), found.getEmployeeId(), names.get(found.getEmployeeId()), found.getWorkDate(), found.getStatus(),
                claim.minutes(), found.getDecidedBy(), found.getDecidedBy() == null ? null : names.get(found.getDecidedBy()), found.getDecidedOn(),
                found.getDecisionNote(), found.getHodApprovedBy() == null ? null : names.get(found.getHodApprovedBy()), found.getHodApprovedOn());
    }
}
