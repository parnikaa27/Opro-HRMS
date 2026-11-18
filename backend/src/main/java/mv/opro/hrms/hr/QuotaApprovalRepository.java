package mv.opro.hrms.hr;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface QuotaApprovalRepository extends JpaRepository<QuotaApproval, String> {

    List<QuotaApproval> findAllByOrderByJobCategoryAscExpiresOnAsc();
}
