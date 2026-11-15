package mv.opro.hrms.attendance;

import java.time.LocalDate;
import java.util.Map;

// A day worked from home as the approvals page shows it. Field names match the frontend's HomeDay.
public record HomeDayResponse(String id, String employeeId, String employeeName, LocalDate date, String status, String decidedBy,
        String decidedByName, LocalDate decidedOn, String decisionNote) {

    public static HomeDayResponse of(HomeDay day, Map<String, String> names) {
        return new HomeDayResponse(day.getId(), day.getEmployeeId(), names.get(day.getEmployeeId()), day.getWorkDate(), day.getStatus(),
                day.getDecidedBy(), day.getDecidedBy() == null ? null : names.get(day.getDecidedBy()), day.getDecidedOn(), day.getDecisionNote());
    }
}
