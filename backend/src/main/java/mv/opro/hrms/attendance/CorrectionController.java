package mv.opro.hrms.attendance;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.tags.Tag;

// An employee's own punch fix requests. Managers decide them from the team view.
@Tag(name = "Punch fixes", description = "Asking your HOD to fix a missed or late punch.")
@RestController
class CorrectionController {

    private static final int MAX_REASON = 300;

    record RaiseCorrection(
            @NotNull LocalDate date,
            @NotNull @Pattern(regexp = "missed-in|missed-out") String kind,
            @NotNull @Pattern(regexp = "resort|forgot|late|other") String category,
            @NotNull LocalTime requestedTime,
            @Size(max = MAX_REASON) String reason) {}

    private final Corrections corrections;
    private final CurrentUser currentUser;

    CorrectionController(Corrections corrections, CurrentUser currentUser) {
        this.corrections = corrections;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/attendance/corrections")
    List<CorrectionResponse> mine() {
        Employee me = currentUser.get();
        return corrections.of(me.getId()).stream().map(request -> CorrectionResponse.of(request, me.getFullName())).toList();
    }

    @PostMapping("/api/attendance/corrections")
    CorrectionResponse raise(@Valid @RequestBody RaiseCorrection body) {
        Employee me = currentUser.get();
        return CorrectionResponse.of(corrections.raise(me, body.date(), body.kind(), body.category(), body.requestedTime(), body.reason()), me.getFullName());
    }
}
