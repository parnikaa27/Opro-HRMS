package mv.opro.hrms.performance;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface GoalRepository extends JpaRepository<Goal, String> {

    List<Goal> findByCycleIdAndEmployeeIdOrderBySortOrder(String cycleId, String employeeId);

    List<Goal> findByCycleIdAndEmployeeIdInOrderBySortOrder(String cycleId, Collection<String> employeeIds);

    void deleteByCycleIdAndEmployeeId(String cycleId, String employeeId);
}
