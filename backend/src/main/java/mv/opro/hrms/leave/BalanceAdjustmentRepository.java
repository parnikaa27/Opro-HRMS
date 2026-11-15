package mv.opro.hrms.leave;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface BalanceAdjustmentRepository extends JpaRepository<BalanceAdjustment, String> {

    List<BalanceAdjustment> findByEmployeeIdOrderByMadeOnDescIdDesc(String employeeId);
}
