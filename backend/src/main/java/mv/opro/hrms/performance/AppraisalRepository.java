package mv.opro.hrms.performance;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface AppraisalRepository extends JpaRepository<Appraisal, String> {

    Optional<Appraisal> findByCycleIdAndEmployeeId(String cycleId, String employeeId);

    List<Appraisal> findByCycleId(String cycleId);

    List<Appraisal> findByEmployeeIdOrderByAppraisedOnDesc(String employeeId);
}
