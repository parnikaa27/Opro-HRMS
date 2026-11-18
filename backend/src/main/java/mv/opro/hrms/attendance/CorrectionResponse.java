package mv.opro.hrms.attendance;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;

// A punch fix request as the portal shows it. Field names match the frontend's CorrectionRequest.
public record CorrectionResponse(String id, String employeeId, String employeeName, LocalDate date, String kind, String category, String requestedTime,
        String reason, String status, LocalDate raisedOn, String decidedBy, LocalDate decidedOn, String decisionNote, String hodApprovedByName,
        LocalDate hodApprovedOn) {

    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");

    public static CorrectionResponse of(CorrectionRequest request, String employeeName) {
        return of(request, employeeName, Map.of());
    }

    // names holds whoever approved it at the HOD step, when HR is shown it.
    public static CorrectionResponse of(CorrectionRequest request, String employeeName, Map<String, String> names) {
        return new CorrectionResponse(request.getId(), request.getEmployeeId(), employeeName, request.getPunchDate(), request.getKind(), request.getCategory(),
                request.getRequestedTime().format(CLOCK), request.getReason(), request.getStatus(), request.getRaisedOn(), request.getDecidedBy(),
                request.getDecidedOn(), request.getDecisionNote(), request.getHodApprovedBy() == null ? null : names.get(request.getHodApprovedBy()),
                request.getHodApprovedOn());
    }
}
