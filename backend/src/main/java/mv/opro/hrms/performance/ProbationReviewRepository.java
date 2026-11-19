package mv.opro.hrms.performance;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface ProbationReviewRepository extends JpaRepository<ProbationReview, String> {

    List<ProbationReview> findByEmployeeIdOrderByReviewedOnDesc(String employeeId);

    List<ProbationReview> findAllByOrderByReviewedOnDesc();
}
