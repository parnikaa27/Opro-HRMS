package mv.opro.hrms.leave;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

// A leave request as the portal shows it. hodApprovedOn is set while it waits for HR after the HOD approved. Field names match the frontend's LeaveRequest.
public record LeaveRequestResponse(String id, String employeeId, String employeeName, String type, LocalDate from, LocalDate to, String halfDay,
        BigDecimal days, String reason, String status, LocalDate appliedOn, String decidedBy, String decidedByName, LocalDate decidedOn,
        String decisionNote, boolean hasCertificate, String hodApprovedByName, LocalDate hodApprovedOn) {

    public static LeaveRequestResponse of(LeaveRequest request, String employeeName, Map<String, String> names) {
        return new LeaveRequestResponse(request.getId(), request.getEmployeeId(), employeeName, request.getType(), request.getFromDate(),
                request.getToDate(), request.getHalfDay(), request.getDays(), request.getReason(), request.getStatus(), request.getAppliedOn(),
                request.getDecidedBy(), request.getDecidedBy() == null ? null : names.get(request.getDecidedBy()), request.getDecidedOn(),
                request.getDecisionNote(), request.hasCertificate(),
                request.getHodApprovedBy() == null ? null : names.get(request.getHodApprovedBy()), request.getHodApprovedOn());
    }
}
