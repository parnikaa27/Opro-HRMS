package mv.opro.hrms.attendance;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// Punch fix requests. Raising one is the employee's part; deciding it is the manager's, built with the team view.
@RestController
class CorrectionController {

    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");
    private static final int MAX_REASON = 300;

    record RaiseCorrection(
            @NotNull LocalDate date,
            @NotNull @Pattern(regexp = "missed-in|missed-out") String kind,
            @NotNull LocalTime requestedTime,
            @NotBlank @Size(max = MAX_REASON) String reason) {}

    record CorrectionResponse(String id, String employeeId, LocalDate date, String kind, String requestedTime, String reason, String status,
            LocalDate raisedOn, String decidedBy, LocalDate decidedOn, String decisionNote) {

        static CorrectionResponse of(CorrectionRequest request) {
            return new CorrectionResponse(request.getId(), request.getEmployeeId(), request.getPunchDate(), request.getKind(),
                    request.getRequestedTime().format(CLOCK), request.getReason(), request.getStatus(), request.getRaisedOn(),
                    request.getDecidedBy(), request.getDecidedOn(), request.getDecisionNote());
        }
    }

    private final CorrectionRequestRepository corrections;
    private final CurrentUser currentUser;
    private final Clock clock;

    CorrectionController(CorrectionRequestRepository corrections, CurrentUser currentUser, Clock clock) {
        this.corrections = corrections;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @GetMapping("/api/attendance/corrections")
    List<CorrectionResponse> mine() {
        return corrections.findByEmployeeIdOrderByRaisedOnDescPunchDateDesc(currentUser.get().getId()).stream().map(CorrectionResponse::of).toList();
    }

    @PostMapping("/api/attendance/corrections")
    @Transactional
    CorrectionResponse raise(@Valid @RequestBody RaiseCorrection body) {
        Employee me = currentUser.get();
        LocalDate today = LocalDate.now(clock);
        if (body.date().isAfter(today)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You can't fix a day that hasn't happened yet.");
        }
        if (body.date().isBefore(me.getJoinedOn())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "That's before you joined.");
        }
        CorrectionRequest request = CorrectionRequest.raise(Ids.next("AC"), me.getId(), body.date(), body.kind(), body.requestedTime(),
                body.reason().strip(), today);
        return CorrectionResponse.of(corrections.save(request));
    }
}
