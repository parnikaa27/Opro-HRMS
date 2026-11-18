package mv.opro.hrms.leave;

import jakarta.servlet.http.HttpServletRequest;
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
import java.util.stream.Stream;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.files.Files;
import mv.opro.hrms.files.Upload;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Leave", description = "Your own leave: types, balances, requests, cancelling and medical certificates.")
@RestController
class LeaveController {

    private static final int MAX_REASON = 300;
    private static final int MAX_CERTIFICATE_BYTES = 5 * Upload.MEGABYTE;

    // Days are left out on purpose: the server counts them. Anything the client sends for days is ignored.
    record ApplyLeave(
            @NotBlank String type,
            @NotNull LocalDate from,
            @NotNull LocalDate to,
            @Pattern(regexp = "first|second") String halfDay,
            @NotBlank @Size(max = MAX_REASON) String reason) {}

    private final LeaveService leave;
    private final CurrentUser currentUser;
    private final People people;
    private final Files files;

    LeaveController(LeaveService leave, CurrentUser currentUser, People people, Files files) {
        this.leave = leave;
        this.currentUser = currentUser;
        this.people = people;
        this.files = files;
    }

    @GetMapping("/api/leave/types")
    List<LeaveTypeResponse> types() {
        return leave.types().stream().map(LeaveTypeResponse::of).toList();
    }

    @GetMapping("/api/leave/balances")
    List<LeaveService.Balance> balances() {
        return leave.balancesOf(currentUser.get().getId());
    }

    @GetMapping("/api/leave/requests")
    List<LeaveRequestResponse> requests() {
        Employee me = currentUser.get();
        List<LeaveRequest> requests = leave.requestsOf(me.getId());
        Map<String, String> deciders = people.namesOf(requests.stream()
                .flatMap(request -> Stream.of(request.getDecidedBy(), request.getHodApprovedBy())).filter(Objects::nonNull).collect(Collectors.toSet()));
        return requests.stream().map(request -> LeaveRequestResponse.of(request, me.getFullName(), deciders)).toList();
    }

    @PostMapping("/api/leave/requests")
    LeaveRequestResponse apply(@Valid @RequestBody ApplyLeave body) {
        Employee me = currentUser.get();
        LeaveRequest request = leave.apply(me, new LeaveService.Application(body.type(), body.from(), body.to(), body.halfDay(), body.reason()));
        return LeaveRequestResponse.of(request, me.getFullName(), Map.of());
    }

    @PutMapping("/api/leave/requests/{id}/certificate")
    LeaveRequestResponse attachCertificate(@PathVariable String id, HttpServletRequest request) {
        Employee me = currentUser.get();
        LeaveRequest updated = leave.attachCertificate(me, id, Upload.read(request, Upload.CERTIFICATE, MAX_CERTIFICATE_BYTES));
        return LeaveRequestResponse.of(updated, me.getFullName(), Map.of());
    }

    // Opens in a new tab. Never cached: it's health data.
    @GetMapping("/api/leave/requests/{id}/certificate")
    ResponseEntity<byte[]> certificate(@PathVariable String id) {
        return files.serve(leave.certificateOf(currentUser.get(), id), "certificate-" + id, false, CacheControl.noStore());
    }

    @PostMapping("/api/leave/requests/{id}/cancel")
    LeaveRequestResponse cancel(@PathVariable String id) {
        Employee me = currentUser.get();
        return LeaveRequestResponse.of(leave.cancel(me, id), me.getFullName(), Map.of());
    }
}
