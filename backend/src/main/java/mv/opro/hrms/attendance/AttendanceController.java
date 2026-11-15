package mv.opro.hrms.attendance;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
class AttendanceController {

    // Where the browser says it is. Only needed from the office, and never stored.
    record PunchBody(
            @NotNull @Pattern(regexp = "office|home") String mode,
            @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @DecimalMin("-180") @DecimalMax("180") Double longitude,
            @PositiveOrZero Double accuracy) {

        PunchClock.Location location() {
            return latitude == null || longitude == null || accuracy == null ? null : new PunchClock.Location(latitude, longitude, accuracy);
        }
    }

    private final AttendanceService attendance;
    private final PunchClock punchClock;
    private final CurrentUser currentUser;

    AttendanceController(AttendanceService attendance, PunchClock punchClock, CurrentUser currentUser) {
        this.attendance = attendance;
        this.punchClock = punchClock;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/attendance")
    List<AttendanceDay> month(@RequestParam String month) {
        try {
            return attendance.month(currentUser.get(), YearMonth.parse(month));
        } catch (DateTimeParseException error) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Month must look like 2026-11");
        }
    }

    // Returns today as it now stands, so the screen can show the new punch straight away.
    @PostMapping("/api/attendance/punch")
    AttendanceDay punch(@Valid @RequestBody PunchBody body) {
        Employee me = currentUser.get();
        punchClock.punch(me, body.mode(), body.location());
        return attendance.today(me).stream().findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "You can only punch on days you work here."));
    }
}
