package mv.opro.hrms.hr;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// The expatriate quota: what the Ministry granted per job category, and how many slots are in use.
@Tag(name = "HR: expatriate quota", description = "Quota approvals by job category, with slots used counted from active expatriates. HR only.")
@RestController
class HrQuotaController {

    private static final int MAX_SLOTS = 10_000;

    record QuotaBody(@NotBlank @Size(max = 80) String jobCategory, @NotNull @Min(1) @Max(MAX_SLOTS) Integer slots,
            @NotBlank @Size(max = 40) String approvalNumber, @NotNull LocalDate approvedOn, @NotNull LocalDate expiresOn) {

        QuotaApproval.Terms terms() {
            return new QuotaApproval.Terms(jobCategory.strip(), slots, approvalNumber.strip(), approvedOn, expiresOn);
        }
    }

    private final HrAccess hr;
    private final CurrentUser currentUser;
    private final Quotas quotas;

    HrQuotaController(HrAccess hr, CurrentUser currentUser, Quotas quotas) {
        this.hr = hr;
        this.currentUser = currentUser;
        this.quotas = quotas;
    }

    @GetMapping("/api/hr/quotas")
    List<Quotas.QuotaResponse> list() {
        hr.require(currentUser.get());
        return quotas.list();
    }

    @PostMapping("/api/hr/quotas")
    Quotas.QuotaResponse add(@Valid @RequestBody QuotaBody body) {
        hr.require(currentUser.get());
        return quotas.save(null, body.terms());
    }

    @PutMapping("/api/hr/quotas/{id}")
    Quotas.QuotaResponse change(@PathVariable String id, @Valid @RequestBody QuotaBody body) {
        hr.require(currentUser.get());
        return quotas.save(id, body.terms());
    }

    @DeleteMapping("/api/hr/quotas/{id}")
    ResponseEntity<Void> remove(@PathVariable String id) {
        hr.require(currentUser.get());
        quotas.remove(id);
        return ResponseEntity.noContent().build();
    }
}
