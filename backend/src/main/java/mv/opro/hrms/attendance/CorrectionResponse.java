package mv.opro.hrms.attendance;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

// A punch fix request as the portal shows it. Field names match the frontend's CorrectionRequest.
public record CorrectionResponse(String id, String employeeId, String employeeName, LocalDate date, String kind, String category, String requestedTime,
        String reason, String status, LocalDate raisedOn, String decidedBy, LocalDate decidedOn, String decisionNote) {

    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");

    public static CorrectionResponse of(CorrectionRequest request, String employeeName) {
        return new CorrectionResponse(request.getId(), request.getEmployeeId(), employeeName, request.getPunchDate(), request.getKind(), request.getCategory(),
                request.getRequestedTime().format(CLOCK), request.getReason(), request.getStatus(), request.getRaisedOn(), request.getDecidedBy(),
                request.getDecidedOn(), request.getDecisionNote());
    }
}
