package mv.opro.hrms.hr;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.attendance.CorrectionRequest;
import mv.opro.hrms.attendance.CorrectionResponse;
import mv.opro.hrms.attendance.Corrections;
import mv.opro.hrms.attendance.HomeDay;
import mv.opro.hrms.attendance.HomeDayResponse;
import mv.opro.hrms.attendance.HomeDays;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.files.Files;
import mv.opro.hrms.leave.BalanceAdjustment;
import mv.opro.hrms.leave.LeaveRequest;
import mv.opro.hrms.leave.LeaveRequestResponse;
import mv.opro.hrms.leave.LeaveService;
import mv.opro.hrms.leave.LeaveType;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// HR's leave work: every request in the company, recording leave for someone, balances and the policy.
// HR never acts on their own leave here: that still goes to their manager.
@RestController
class HrLeaveController {

    private static final int MAX_NOTE = 300;
    private static final String MAX_DAYS = "365";

    record RecordLeave(
            @NotBlank String employeeId,
            @NotBlank String type,
            @NotNull LocalDate from,
            @NotNull LocalDate to,
            @Pattern(regexp = "first|second") String halfDay,
            @NotBlank @Size(max = MAX_NOTE) String reason) {}

    record DecisionBody(@NotNull @Pattern(regexp = "approved|rejected") String decision, @Size(max = MAX_NOTE) String note) {}

    record AdjustBody(
            @NotBlank String employeeId,
            @NotBlank String type,
            @NotNull @DecimalMin("-" + MAX_DAYS) @DecimalMax(MAX_DAYS) BigDecimal days,
            @NotBlank @Size(max = MAX_NOTE) String reason) {}

    record PolicyBody(@NotBlank @Size(max = 60) String name, @NotNull Boolean allowsHalfDay,
            @DecimalMin("0") @DecimalMax(MAX_DAYS) BigDecimal defaultEntitlement) {}

    record LeaveTypeResponse(String code, String name, boolean allowsHalfDay, boolean isUnlimited, BigDecimal defaultEntitlement,
            Integer documentRequiredAfterDays) {}

    private final HrAccess hr;
    private final CurrentUser currentUser;
    private final People people;
    private final LeaveService leave;
    private final Corrections corrections;
    private final HomeDays homeDays;
    private final Files files;

    HrLeaveController(HrAccess hr, CurrentUser currentUser, People people, LeaveService leave, Corrections corrections, HomeDays homeDays, Files files) {
        this.hr = hr;
        this.currentUser = currentUser;
        this.people = people;
        this.leave = leave;
        this.corrections = corrections;
        this.homeDays = homeDays;
        this.files = files;
    }

    @GetMapping("/api/hr/leave-requests")
    List<LeaveRequestResponse> requests(@RequestParam(required = false) String status) {
        hr.require(currentUser.get());
        List<LeaveRequest> requests = leave.allRequests(status);
        Map<String, String> names = people.namesOf(requests.stream()
                .flatMap(request -> Stream.of(request.getEmployeeId(), request.getDecidedBy()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        return requests.stream().map(request -> LeaveRequestResponse.of(request, names.get(request.getEmployeeId()), names)).toList();
    }

    @PostMapping("/api/hr/leave-requests")
    LeaveRequestResponse record(@Valid @RequestBody RecordLeave body) {
        Employee me = hr.require(currentUser.get());
        Employee employee = someoneElse(me, body.employeeId());
        LeaveRequest recorded = leave.recordFor(me, employee,
                new LeaveService.Application(body.type(), body.from(), body.to(), body.halfDay(), body.reason()));
        return LeaveRequestResponse.of(recorded, employee.getFullName(), Map.of(me.getId(), me.getFullName()));
    }

    @PostMapping("/api/hr/leave-requests/{id}/decision")
    LeaveRequestResponse decideLeave(@PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = hr.require(currentUser.get());
        LeaveRequest decided = leave.decide(me, id, everyoneBut(me), new LeaveService.Decision(body.decision(), body.note()));
        return LeaveRequestResponse.of(decided, people.namesOf(Set.of(decided.getEmployeeId())).get(decided.getEmployeeId()),
                Map.of(me.getId(), me.getFullName()));
    }

    @GetMapping("/api/hr/corrections")
    List<CorrectionResponse> corrections(@RequestParam(required = false) String status) {
        hr.require(currentUser.get());
        List<CorrectionRequest> all = corrections.all(status);
        Map<String, String> names = people.namesOf(all.stream().map(CorrectionRequest::getEmployeeId).collect(Collectors.toSet()));
        return all.stream().map(request -> CorrectionResponse.of(request, names.get(request.getEmployeeId()))).toList();
    }

    @PostMapping("/api/hr/corrections/{id}/decision")
    CorrectionResponse decideCorrection(@PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = hr.require(currentUser.get());
        CorrectionRequest decided = corrections.decide(me, id, everyoneBut(me), new Corrections.Decision(body.decision(), body.note()));
        return CorrectionResponse.of(decided, people.namesOf(Set.of(decided.getEmployeeId())).get(decided.getEmployeeId()));
    }

    @GetMapping("/api/hr/home-days")
    List<HomeDayResponse> homeDays(@RequestParam(required = false) String status) {
        hr.require(currentUser.get());
        List<HomeDay> days = homeDays.all(status);
        Map<String, String> names = people.namesOf(days.stream()
                .flatMap(day -> Stream.of(day.getEmployeeId(), day.getDecidedBy()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        return days.stream().map(day -> HomeDayResponse.of(day, names)).toList();
    }

    @PostMapping("/api/hr/home-days/{id}/decision")
    HomeDayResponse decideHomeDay(@PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = hr.require(currentUser.get());
        HomeDay decided = homeDays.decide(me, id, everyoneBut(me), new Corrections.Decision(body.decision(), body.note()));
        return HomeDayResponse.of(decided, people.namesOf(Set.of(decided.getEmployeeId(), me.getId())));
    }

    @PostMapping("/api/hr/balance-adjustments")
    HrPeopleController.AdjustmentResponse adjust(@Valid @RequestBody AdjustBody body) {
        Employee me = hr.require(currentUser.get());
        someoneElse(me, body.employeeId());
        if (body.days().signum() == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Enter how many days to add or remove.");
        }
        BalanceAdjustment change = leave.adjust(me, body.employeeId(), body.type(), body.days(), body.reason());
        return new HrPeopleController.AdjustmentResponse(change.getId(), change.getEmployeeId(), change.getType(), change.getDays(), change.getReason(), me.getId(),
                me.getFullName(), change.getMadeOn());
    }

    @PutMapping("/api/hr/leave-types/{code}")
    LeaveTypeResponse policy(@PathVariable String code, @Valid @RequestBody PolicyBody body) {
        hr.require(currentUser.get());
        LeaveType type = leave.updateType(code, body.name(), body.allowsHalfDay(), body.defaultEntitlement());
        return new LeaveTypeResponse(type.getCode(), type.getName(), type.allowsHalfDay(), type.isUnlimited(), type.getDefaultEntitlement(),
                type.getDocumentRequiredAfterDays());
    }

    // Health data. HR opens it in a new tab; it's never cached.
    @GetMapping("/api/hr/leave-requests/{id}/certificate")
    ResponseEntity<byte[]> certificate(@PathVariable String id) {
        hr.require(currentUser.get());
        return files.serve(leave.certificateOfAnyone(id), "certificate-" + id, false, CacheControl.noStore());
    }

    // Everyone HR may act for: active people, apart from themselves.
    private Set<String> everyoneBut(Employee me) {
        return people.active().stream().map(Employee::getId).filter(id -> !id.equals(me.getId())).collect(Collectors.toUnmodifiableSet());
    }

    private Employee someoneElse(Employee me, String employeeId) {
        if (employeeId.equals(me.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Your own leave goes through your manager.");
        }
        return people.findActive(employeeId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employee not found"));
    }
}
