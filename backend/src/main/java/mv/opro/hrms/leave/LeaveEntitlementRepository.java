package mv.opro.hrms.leave;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface LeaveEntitlementRepository extends JpaRepository<LeaveEntitlement, LeaveEntitlement.Key> {

    List<LeaveEntitlement> findByEmployeeIdAndLeaveYear(String employeeId, int leaveYear);

    Optional<LeaveEntitlement> findByEmployeeIdAndTypeAndLeaveYear(String employeeId, String type, int leaveYear);
}
