package mv.opro.hrms.allowance;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.session.CurrentUser;
import mv.opro.hrms.team.TeamAccess;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// Someone's own allowances, the kinds there are, and an HOD granting a report a one-off amount.
@Tag(name = "Allowances", description = "Your own monthly allowances and one-off grants, the kinds of allowance, and an HOD's one-off grants to their reports.")
@RestController
class AllowanceController {

    static final String MAX_AMOUNT = "1000000";

    record GrantBody(@NotBlank String employeeId, @NotBlank String type, @NotNull @DecimalMin("0.01") @DecimalMax(MAX_AMOUNT) BigDecimal amount,
            @NotNull @Pattern(regexp = "MVR|USD") String currency, @NotBlank @Size(max = 300) String reason) {}

    private final Allowances allowances;
    private final AllowanceViews views;
    private final CurrentUser currentUser;
    private final TeamAccess access;

    AllowanceController(Allowances allowances, AllowanceViews views, CurrentUser currentUser, TeamAccess access) {
        this.allowances = allowances;
        this.views = views;
        this.currentUser = currentUser;
        this.access = access;
    }

    @GetMapping("/api/allowances")
    AllowanceResponses.AllowancesResponse mine() {
        return views.of(currentUser.get().getId());
    }

    @GetMapping("/api/allowance-types")
    List<AllowanceResponses.TypeResponse> types() {
        return allowances.types().stream().map(AllowanceResponses.TypeResponse::of).toList();
    }

    // Grants the HOD's reports have had, newest first.
    @GetMapping("/api/team/allowance-grants")
    List<AllowanceResponses.GrantResponse> team() {
        return views.grants(allowances.grantsOf(access.reportsOf(currentUser.get()).stream().map(Employee::getId).toList()));
    }

    @PostMapping("/api/team/allowance-grants")
    AllowanceResponses.GrantResponse grant(@Valid @RequestBody GrantBody body) {
        Employee me = currentUser.get();
        boolean isReport = access.reportsOf(me).stream().anyMatch(report -> report.getId().equals(body.employeeId()));
        if (!isReport) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Not one of your reports");
        }
        AllowanceGrant saved = allowances.grant(me, body.employeeId(), new Allowances.Grant(body.type(), body.amount(), body.currency(), body.reason()));
        return views.grants(List.of(saved)).getFirst();
    }
}
