package mv.opro.hrms.hr;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.files.Files;
import mv.opro.hrms.leave.BalanceAdjustment;
import mv.opro.hrms.leave.LeaveRequest;
import mv.opro.hrms.leave.LeaveRequestResponse;
import mv.opro.hrms.leave.LeaveService;
import mv.opro.hrms.leave.LeaveType;
import mv.opro.hrms.leave.LeaveTypeResponse;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.tags.Tag;

// HR's leave work: every request in the company (read only, decisions are the manager's), balances and the policy.
// HR never changes their own leave here.
@Tag(name = "HR: leave", description = "Every leave request (read only), balances, leave types and certificates. HR only. Decisions are the HOD's.")
@RestController
class HrLeaveController {

    private static final int MAX_NOTE = 300;
    private static final String MAX_DAYS = "365";
    private static final int MAX_DAYS_WHOLE = 365;

    record AdjustBody(
            @NotBlank String employeeId,
            @NotBlank String type,
            @NotNull @DecimalMin("-" + MAX_DAYS) @DecimalMax(MAX_DAYS) BigDecimal days,
            @NotBlank @Size(max = MAX_NOTE) String reason) {}

    record PolicyBody(
            @NotBlank @Size(max = 60) String name,
            @NotNull Boolean allowsHalfDay,
            @NotNull Boolean isUnlimited,
            @DecimalMin("0") @DecimalMax(MAX_DAYS) BigDecimal defaultEntitlement,
            @Min(1) @Max(MAX_DAYS_WHOLE) Integer documentRequiredAfterDays,
            @NotNull Boolean isForEveryone,
            @NotNull Boolean carriesForward,
            @DecimalMin("0") @DecimalMax(MAX_DAYS) BigDecimal carryForwardCap,
            @NotNull Boolean needsHrApproval,
            @Min(1) @Max(MAX_DAYS_WHOLE) Integer noticeDays) {

        LeaveType.Rules rules() {
            return new LeaveType.Rules(name, allowsHalfDay, isUnlimited, defaultEntitlement, documentRequiredAfterDays, isForEveryone, carriesForward,
                    carryForwardCap, needsHrApproval, noticeDays);
        }
    }

    record SetDaysBody(@NotNull @DecimalMin("0") @DecimalMax(MAX_DAYS) BigDecimal days, @NotBlank @Size(max = MAX_NOTE) String reason) {}

    record ReasonBody(@NotBlank @Size(max = MAX_NOTE) String reason) {}

    private final HrAccess hr;
    private final CurrentUser currentUser;
    private final People people;
    private final LeaveService leave;
    private final Files files;

    HrLeaveController(HrAccess hr, CurrentUser currentUser, People people, LeaveService leave, Files files) {
        this.hr = hr;
        this.currentUser = currentUser;
        this.people = people;
        this.leave = leave;
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

    @PostMapping("/api/hr/leave-types")
    LeaveTypeResponse addType(@Valid @RequestBody PolicyBody body) {
        hr.require(currentUser.get());
        return LeaveTypeResponse.of(leave.addType(body.rules()));
    }

    @PutMapping("/api/hr/leave-types/{code}")
    LeaveTypeResponse policy(@PathVariable String code, @Valid @RequestBody PolicyBody body) {
        hr.require(currentUser.get());
        return LeaveTypeResponse.of(leave.updateType(code, body.rules()));
    }

    // Deleted if nobody ever used it, otherwise retired.
    @DeleteMapping("/api/hr/leave-types/{code}")
    ResponseEntity<Void> removeType(@PathVariable String code) {
        hr.require(currentUser.get());
        leave.removeType(code);
        return ResponseEntity.noContent().build();
    }

    // One person's days of a type this year. Also how a type is given to just one person.
    @PutMapping("/api/hr/employees/{id}/leave/{code}")
    ResponseEntity<Void> setDays(@PathVariable String id, @PathVariable String code, @Valid @RequestBody SetDaysBody body) {
        Employee me = hr.require(currentUser.get());
        someoneElse(me, id);
        leave.setDays(me, id, code, body.days(), body.reason());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/hr/employees/{id}/leave/{code}/remove")
    ResponseEntity<Void> removeFromPerson(@PathVariable String id, @PathVariable String code, @Valid @RequestBody ReasonBody body) {
        Employee me = hr.require(currentUser.get());
        someoneElse(me, id);
        leave.removeFrom(id, code, body.reason());
        return ResponseEntity.noContent().build();
    }

    // Health data. HR opens it in a new tab; it's never cached.
    @GetMapping("/api/hr/leave-requests/{id}/certificate")
    ResponseEntity<byte[]> certificate(@PathVariable String id) {
        hr.require(currentUser.get());
        return files.serve(leave.certificateOfAnyone(id), "certificate-" + id, false, CacheControl.noStore());
    }

    private Employee someoneElse(Employee me, String employeeId) {
        if (employeeId.equals(me.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Your own leave goes through your manager.");
        }
        return people.findNotLeft(employeeId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employee not found"));
    }
}
