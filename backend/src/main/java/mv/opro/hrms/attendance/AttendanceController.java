package mv.opro.hrms.attendance;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
class AttendanceController {

    private final AttendanceService attendance;
    private final CurrentUser currentUser;

    AttendanceController(AttendanceService attendance, CurrentUser currentUser) {
        this.attendance = attendance;
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
}
