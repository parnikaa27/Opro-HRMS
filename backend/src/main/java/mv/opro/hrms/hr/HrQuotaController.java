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
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// The expatriate quota: what the Ministry granted per job category, and how many slots are in use.
// Used slots are counted from active expatriates with that job category, never stored.
@Tag(name = "HR: expatriate quota", description = "Quota approvals by job category, with slots used counted from active expatriates. HR only.")
@RestController
class HrQuotaController {

    private static final String NATIONAL = "Maldivian";
    private static final int MAX_SLOTS = 10_000;

    record QuotaBody(@NotBlank @Size(max = 80) String jobCategory, @NotNull @Min(1) @Max(MAX_SLOTS) Integer slots,
            @NotBlank @Size(max = 40) String approvalNumber, @NotNull LocalDate approvedOn, @NotNull LocalDate expiresOn) {

        QuotaApproval.Terms terms() {
            return new QuotaApproval.Terms(jobCategory.strip(), slots, approvalNumber.strip(), approvedOn, expiresOn);
        }
    }

    record QuotaResponse(String id, String jobCategory, int slots, int used, String approvalNumber, LocalDate approvedOn, LocalDate expiresOn) {}

    private final HrAccess hr;
    private final CurrentUser currentUser;
    private final People people;
    private final QuotaApprovalRepository quotas;

    HrQuotaController(HrAccess hr, CurrentUser currentUser, People people, QuotaApprovalRepository quotas) {
        this.hr = hr;
        this.currentUser = currentUser;
        this.people = people;
        this.quotas = quotas;
    }

    @GetMapping("/api/hr/quotas")
    List<QuotaResponse> list() {
        hr.require(currentUser.get());
        Map<String, Long> used = people.active().stream()
                .filter(employee -> !NATIONAL.equalsIgnoreCase(employee.getNationality()) && employee.getJobCategory() != null)
                .collect(Collectors.groupingBy(employee -> key(employee.getJobCategory()), Collectors.counting()));
        return quotas.findAllByOrderByJobCategoryAscExpiresOnAsc().stream()
                .map(quota -> response(quota, used.getOrDefault(key(quota.getJobCategory()), 0L).intValue()))
                .toList();
    }

    @PostMapping("/api/hr/quotas")
    @Transactional
    QuotaResponse add(@Valid @RequestBody QuotaBody body) {
        hr.require(currentUser.get());
        return save(new QuotaApproval(Ids.next("QA")), body);
    }

    @PutMapping("/api/hr/quotas/{id}")
    @Transactional
    QuotaResponse change(@PathVariable String id, @Valid @RequestBody QuotaBody body) {
        hr.require(currentUser.get());
        return save(quotas.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Quota not found")), body);
    }

    @DeleteMapping("/api/hr/quotas/{id}")
    @Transactional
    ResponseEntity<Void> remove(@PathVariable String id) {
        hr.require(currentUser.get());
        quotas.delete(quotas.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Quota not found")));
        return ResponseEntity.noContent().build();
    }

    private QuotaResponse save(QuotaApproval quota, QuotaBody body) {
        if (!body.expiresOn().isAfter(body.approvedOn())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The expiry has to come after the approval date.");
        }
        quota.change(body.terms());
        QuotaApproval saved = quotas.save(quota);
        int used = (int) people.active().stream()
                .filter(employee -> !NATIONAL.equalsIgnoreCase(employee.getNationality()) && key(saved.getJobCategory()).equals(key(employee.getJobCategory())))
                .count();
        return response(saved, used);
    }

    private static QuotaResponse response(QuotaApproval quota, int used) {
        return new QuotaResponse(quota.getId(), quota.getJobCategory(), quota.getSlots(), used, quota.getApprovalNumber(), quota.getApprovedOn(),
                quota.getExpiresOn());
    }

    // "Engineering" and "engineering " are the same category.
    private static String key(String jobCategory) {
        return jobCategory == null ? "" : jobCategory.strip().toLowerCase(Locale.ROOT);
    }
}
