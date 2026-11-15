package mv.opro.hrms.hr;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import mv.opro.hrms.attendance.AttendanceDay;
import mv.opro.hrms.attendance.AttendanceService;
import mv.opro.hrms.attendance.PunchEdit;
import mv.opro.hrms.attendance.PunchEditor;
import mv.opro.hrms.attendance.ScheduleEditor;
import mv.opro.hrms.attendance.WorkSchedule;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
class HrAttendanceController {

    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");
    private static final int MAX_REASON = 300;
    private static final int MAX_GRACE = 60;
    private static final int MINUTES_IN_A_DAY = 1440;

    record PunchEditBody(@NotBlank String employeeId, @NotNull LocalDate date, @NotNull @Pattern(regexp = "add|void") String action,
            @NotNull LocalTime time, @NotBlank @Size(max = MAX_REASON) String reason) {}

    record PunchEditResponse(String id, String employeeId, LocalDate date, String action, String time, String reason, String by, String byName,
            LocalDate on) {}

    record ScheduleBody(@NotNull LocalDate effectiveFrom, @NotNull LocalTime shiftStart, @NotNull LocalTime shiftEnd,
            @NotNull @Min(0) @Max(MAX_GRACE) Integer graceMinutes, @NotNull @Min(1) @Max(MINUTES_IN_A_DAY) Integer halfDayMinutes,
            @NotNull LocalTime ramadanStart, @NotNull LocalTime ramadanEnd, @NotBlank @Size(max = MAX_REASON) String reason) {}

    record ScheduleResponse(String id, LocalDate effectiveFrom, String shiftStart, String shiftEnd, int graceMinutes, int halfDayMinutes,
            String ramadanStart, String ramadanEnd, String reason, String setBy, String setByName, LocalDate setOn) {

        static ScheduleResponse of(WorkSchedule version, Map<String, String> names) {
            return new ScheduleResponse(version.getId(), version.getEffectiveFrom(), version.getShiftStart().format(CLOCK), version.getShiftEnd().format(CLOCK),
                    version.getGraceMinutes(), version.getHalfDayMinutes(), version.getRamadanStart().format(CLOCK), version.getRamadanEnd().format(CLOCK),
                    version.getReason(), version.getSetBy(), names.get(version.getSetBy()), version.getSetOn());
        }
    }

    private final HrAccess hr;
    private final CurrentUser currentUser;
    private final People people;
    private final HrPeople hrPeople;
    private final AttendanceService attendance;
    private final PunchEditor punchEditor;
    private final ScheduleEditor schedules;

    HrAttendanceController(HrAccess hr, CurrentUser currentUser, People people, HrPeople hrPeople, AttendanceService attendance,
            PunchEditor punchEditor, ScheduleEditor schedules) {
        this.hr = hr;
        this.currentUser = currentUser;
        this.people = people;
        this.hrPeople = hrPeople;
        this.attendance = attendance;
        this.punchEditor = punchEditor;
        this.schedules = schedules;
    }

    @GetMapping("/api/hr/attendance")
    List<AttendanceDay> month(@RequestParam String employeeId, @RequestParam String month) {
        hr.require(currentUser.get());
        Employee employee = hrPeople.find(employeeId);
        return attendance.month(employee, parse(month)).stream().map(day -> day.named(employee.getFullName())).toList();
    }

    @GetMapping("/api/hr/punch-edits")
    List<PunchEditResponse> edits(@RequestParam String employeeId, @RequestParam String month) {
        hr.require(currentUser.get());
        List<PunchEdit> edits = punchEditor.of(employeeId, parse(month));
        Map<String, String> names = people.namesOf(edits.stream().map(PunchEdit::getMadeBy).collect(Collectors.toSet()));
        return edits.stream().map(edit -> response(edit, names)).toList();
    }

    @PostMapping("/api/hr/punch-edits")
    PunchEditResponse edit(@Valid @RequestBody PunchEditBody body) {
        Employee me = hr.require(currentUser.get());
        if (body.employeeId().equals(me.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Your own punches go through your manager.");
        }
        Employee employee = hrPeople.find(body.employeeId());
        PunchEdit edit = punchEditor.edit(me, employee, body.date(), body.action(), body.time(), body.reason());
        return response(edit, Map.of(me.getId(), me.getFullName()));
    }

    @GetMapping("/api/hr/schedules")
    List<ScheduleResponse> schedules() {
        hr.require(currentUser.get());
        List<WorkSchedule> versions = schedules.newestFirst();
        Map<String, String> names = people.namesOf(versions.stream().map(WorkSchedule::getSetBy).collect(Collectors.toSet()));
        return versions.stream().map(version -> ScheduleResponse.of(version, names)).toList();
    }

    @PostMapping("/api/hr/schedules")
    ScheduleResponse addSchedule(@Valid @RequestBody ScheduleBody body) {
        Employee me = hr.require(currentUser.get());
        WorkSchedule version = schedules.add(me, new ScheduleEditor.Rules(body.effectiveFrom(), body.shiftStart(), body.shiftEnd(), body.graceMinutes(),
                body.halfDayMinutes(), body.ramadanStart(), body.ramadanEnd()), body.reason());
        return ScheduleResponse.of(version, Map.of(me.getId(), me.getFullName()));
    }

    @DeleteMapping("/api/hr/schedules/{id}")
    ResponseEntity<Void> cancelSchedule(@PathVariable String id) {
        hr.require(currentUser.get());
        schedules.cancel(id);
        return ResponseEntity.noContent().build();
    }

    private static PunchEditResponse response(PunchEdit edit, Map<String, String> names) {
        return new PunchEditResponse(edit.getId(), edit.getEmployeeId(), edit.getPunchDate(), edit.getAction(), edit.getPunchTime().format(CLOCK),
                edit.getReason(), edit.getMadeBy(), names.get(edit.getMadeBy()), edit.getMadeOn());
    }

    private static YearMonth parse(String month) {
        try {
            return YearMonth.parse(month);
        } catch (DateTimeParseException error) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Month must look like 2026-11");
        }
    }
}
