package mv.opro.hrms.leave;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
class LeaveController {

    private static final int MAX_REASON = 300;

    // Days are left out on purpose: the server counts them. Anything the client sends for days is ignored.
    record ApplyLeave(
            @NotBlank String type,
            @NotNull LocalDate from,
            @NotNull LocalDate to,
            @Pattern(regexp = "first|second") String halfDay,
            @NotBlank @Size(max = MAX_REASON) String reason) {}

    record LeaveTypeResponse(String code, String name, boolean allowsHalfDay, boolean isUnlimited, BigDecimal defaultEntitlement,
            Integer documentRequiredAfterDays) {}

    private final LeaveService leave;
    private final CurrentUser currentUser;
    private final People people;

    LeaveController(LeaveService leave, CurrentUser currentUser, People people) {
        this.leave = leave;
        this.currentUser = currentUser;
        this.people = people;
    }

    @GetMapping("/api/leave/types")
    List<LeaveTypeResponse> types() {
        return leave.types().stream()
                .map(type -> new LeaveTypeResponse(type.getCode(), type.getName(), type.allowsHalfDay(), type.isUnlimited(),
                        type.getDefaultEntitlement(), type.getDocumentRequiredAfterDays()))
                .toList();
    }

    @GetMapping("/api/leave/balances")
    List<LeaveService.Balance> balances() {
        return leave.balancesOf(currentUser.get().getId());
    }

    @GetMapping("/api/leave/requests")
    List<LeaveRequestResponse> requests() {
        Employee me = currentUser.get();
        List<LeaveRequest> requests = leave.requestsOf(me.getId());
        Map<String, String> deciders = people.namesOf(requests.stream().map(LeaveRequest::getDecidedBy).filter(Objects::nonNull).collect(Collectors.toSet()));
        return requests.stream().map(request -> LeaveRequestResponse.of(request, me.getFullName(), deciders)).toList();
    }

    @PostMapping("/api/leave/requests")
    LeaveRequestResponse apply(@Valid @RequestBody ApplyLeave body) {
        Employee me = currentUser.get();
        LeaveRequest request = leave.apply(me, new LeaveService.Application(body.type(), body.from(), body.to(), body.halfDay(), body.reason()));
        return LeaveRequestResponse.of(request, me.getFullName(), Map.of());
    }

    @PostMapping("/api/leave/requests/{id}/cancel")
    LeaveRequestResponse cancel(@PathVariable String id) {
        Employee me = currentUser.get();
        return LeaveRequestResponse.of(leave.cancel(me, id), me.getFullName(), Map.of());
    }
}
