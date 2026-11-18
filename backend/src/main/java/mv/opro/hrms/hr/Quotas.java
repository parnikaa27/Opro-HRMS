package mv.opro.hrms.hr;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.employee.People;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Expatriate quota approvals. Used slots are counted from active expatriates with that job category, never stored.
@Service
@Transactional(readOnly = true)
public class Quotas {

    private static final String NATIONAL = "Maldivian";

    public record QuotaResponse(String id, String jobCategory, int slots, int used, String approvalNumber, LocalDate approvedOn, LocalDate expiresOn) {}

    private final QuotaApprovalRepository quotas;
    private final People people;

    Quotas(QuotaApprovalRepository quotas, People people) {
        this.quotas = quotas;
        this.people = people;
    }

    public List<QuotaResponse> list() {
        Map<String, Long> used = usedByCategory();
        return quotas.findAllByOrderByJobCategoryAscExpiresOnAsc().stream()
                .map(quota -> response(quota, used.getOrDefault(key(quota.getJobCategory()), 0L).intValue()))
                .toList();
    }

    @Transactional
    QuotaResponse save(String id, QuotaApproval.Terms terms) {
        if (!terms.expiresOn().isAfter(terms.approvedOn())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The expiry has to come after the approval date.");
        }
        QuotaApproval quota = id == null ? new QuotaApproval(Ids.next("QA"))
                : quotas.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Quota not found"));
        quota.change(terms);
        QuotaApproval saved = quotas.save(quota);
        return response(saved, usedByCategory().getOrDefault(key(saved.getJobCategory()), 0L).intValue());
    }

    @Transactional
    void remove(String id) {
        quotas.delete(quotas.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Quota not found")));
    }

    private Map<String, Long> usedByCategory() {
        return people.active().stream()
                .filter(employee -> !NATIONAL.equalsIgnoreCase(employee.getNationality()) && employee.getJobCategory() != null)
                .collect(Collectors.groupingBy(employee -> key(employee.getJobCategory()), Collectors.counting()));
    }

    private static QuotaResponse response(QuotaApproval quota, int used) {
        return new QuotaResponse(quota.getId(), quota.getJobCategory(), quota.getSlots(), used, quota.getApprovalNumber(), quota.getApprovedOn(),
                quota.getExpiresOn());
    }

    // "Engineering" and "engineering " are the same category.
    private static String key(String jobCategory) {
        return jobCategory.strip().toLowerCase(Locale.ROOT);
    }
}
