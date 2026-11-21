package mv.opro.hrms.flight;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface FlightAllowanceRepository extends JpaRepository<FlightAllowance, FlightAllowance.Key> {

    // The latest allowance set for that year or before.
    Optional<FlightAllowance> findFirstByEmployeeIdAndAllowanceYearLessThanEqualOrderByAllowanceYearDesc(String employeeId, int allowanceYear);
}
