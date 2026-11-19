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
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.hr.HrAccess;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// HR's side of allowances: setting and stopping someone's monthly ones, deciding the HOD's one-off grants, and the list of
// kinds. Never their own.
@Tag(name = "HR: allowances", description = "Someone's monthly allowances, one-off grants waiting for HR, and the kinds of allowance. HR only, never their own.")
@RestController
class HrAllowanceController {

    record MonthlyBody(@NotNull @DecimalMin("0.01") @DecimalMax(AllowanceController.MAX_AMOUNT) BigDecimal amount,
            @NotNull @Pattern(regexp = "MVR|USD") String currency, @NotNull LocalDate startsOn, @Size(max = 300) String note) {}

    record StopBody(@NotNull YearMonth lastMonth) {}

    record DecisionBody(@NotNull @Pattern(regexp = "approved|rejected") String decision, @Size(max = 300) String note) {}

    record TypeBody(@NotBlank @Size(max = 60) String name) {}

    private final Allowances allowances;
    private final AllowanceViews views;
    private final HrAccess hr;
    private final CurrentUser currentUser;

    HrAllowanceController(Allowances allowances, AllowanceViews views, HrAccess hr, CurrentUser currentUser) {
        this.allowances = allowances;
        this.views = views;
        this.hr = hr;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/hr/employees/{id}/allowances")
    AllowanceResponses.AllowancesResponse of(@PathVariable String id) {
        hr.require(currentUser.get());
        return views.of(id);
    }

    @PutMapping("/api/hr/employees/{id}/allowances/{type}")
    AllowanceResponses.MonthlyResponse set(@PathVariable String id, @PathVariable String type, @Valid @RequestBody MonthlyBody body) {
        return views.monthly(allowances.setMonthly(someoneElse(id), id, new Allowances.Monthly(type, body.amount(), body.currency(), body.startsOn(), body.note())));
    }

    @PostMapping("/api/hr/employees/{id}/allowances/{type}/stop")
    AllowanceResponses.MonthlyResponse stop(@PathVariable String id, @PathVariable String type, @Valid @RequestBody StopBody body) {
        someoneElse(id);
        return views.monthly(allowances.stopMonthly(id, type, body.lastMonth()));
    }

    @GetMapping("/api/hr/allowance-grants")
    List<AllowanceResponses.GrantResponse> waiting() {
        return views.grants(allowances.waitingForHr(hr.require(currentUser.get())));
    }

    @PostMapping("/api/hr/allowance-grants/{id}/decision")
    AllowanceResponses.GrantResponse decide(@PathVariable String id, @Valid @RequestBody DecisionBody body) {
        AllowanceGrant decided = allowances.decide(hr.require(currentUser.get()), id, "approved".equals(body.decision()), body.note());
        return views.grants(List.of(decided)).getFirst();
    }

    @PostMapping("/api/hr/allowance-types")
    AllowanceResponses.TypeResponse addType(@Valid @RequestBody TypeBody body) {
        hr.require(currentUser.get());
        return AllowanceResponses.TypeResponse.of(allowances.addType(body.name()));
    }

    // Deleted if nobody ever had it, otherwise retired.
    @DeleteMapping("/api/hr/allowance-types/{code}")
    ResponseEntity<Void> removeType(@PathVariable String code) {
        hr.require(currentUser.get());
        allowances.removeType(code);
        return ResponseEntity.noContent().build();
    }

    private Employee someoneElse(String id) {
        Employee me = hr.require(currentUser.get());
        if (me.getId().equals(id)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Another HR person handles your own allowances.");
        }
        return me;
    }
}
