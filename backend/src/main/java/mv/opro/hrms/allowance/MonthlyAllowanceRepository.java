package mv.opro.hrms.allowance;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface MonthlyAllowanceRepository extends JpaRepository<MonthlyAllowance, String> {

    List<MonthlyAllowance> findByEmployeeIdOrderByStartsOnDescIdDesc(String employeeId);

    Optional<MonthlyAllowance> findByEmployeeIdAndTypeCodeAndEndsOnIsNull(String employeeId, String typeCode);

    boolean existsByTypeCode(String typeCode);
}
