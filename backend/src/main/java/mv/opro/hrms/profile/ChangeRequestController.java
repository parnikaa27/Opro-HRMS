package mv.opro.hrms.profile;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.LocalDate;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
class ChangeRequestController {

    private static final int MAX_DETAILS = 300;

    // The same choices as the profile's form.
    record RaiseChange(
            @NotBlank @Pattern(regexp = "Phone number|Emergency contact|Blood group|Name|Something else") String field,
            @NotBlank @Size(max = MAX_DETAILS) String details) {}

    record ChangeRequestResponse(String id, String employeeId, String field, String details, String status, LocalDate raisedOn) {}

    private final ChangeRequestRepository requests;
    private final CurrentUser currentUser;
    private final Clock clock;

    ChangeRequestController(ChangeRequestRepository requests, CurrentUser currentUser, Clock clock) {
        this.requests = requests;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @PostMapping("/api/profile/change-requests")
    @Transactional
    ChangeRequestResponse raise(@Valid @RequestBody RaiseChange body) {
        Employee me = currentUser.get();
        ChangeRequest request = requests.save(ChangeRequest.raise(Ids.next("CR"), me.getId(), body.field(), body.details().strip(), LocalDate.now(clock)));
        return new ChangeRequestResponse(request.getId(), request.getEmployeeId(), request.getField(), request.getDetails(), request.getStatus(),
                request.getRaisedOn());
    }
}
