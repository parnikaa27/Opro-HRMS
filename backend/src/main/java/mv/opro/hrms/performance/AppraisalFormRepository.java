package mv.opro.hrms.performance;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface AppraisalFormRepository extends JpaRepository<AppraisalForm, String> {

    Optional<AppraisalForm> findByCycleIdAndEmployeeId(String cycleId, String employeeId);

    List<AppraisalForm> findByCycleIdAndEmployeeIdIn(String cycleId, Collection<String> employeeIds);
}
