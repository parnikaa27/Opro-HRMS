package mv.opro.hrms.performance;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface AppraisalCycleRepository extends JpaRepository<AppraisalCycle, String> {

    Optional<AppraisalCycle> findByClosedOnIsNull();

    List<AppraisalCycle> findAllByOrderByOpenedOnDesc();
}
