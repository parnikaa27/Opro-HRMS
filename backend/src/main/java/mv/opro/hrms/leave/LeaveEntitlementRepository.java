package mv.opro.hrms.leave;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface LeaveEntitlementRepository extends JpaRepository<LeaveEntitlement, LeaveEntitlement.Key> {

    List<LeaveEntitlement> findByEmployeeIdAndLeaveYear(String employeeId, int leaveYear);

    Optional<LeaveEntitlement> findByEmployeeIdAndTypeAndLeaveYear(String employeeId, String type, int leaveYear);

    boolean existsByType(String type);

    // Two pages loading at once can both open a year. Whichever lands second does nothing.
    @Modifying
    @Query(value = """
            insert into leave_entitlement (employee_id, type, leave_year, entitled, taken_before)
            values (:employeeId, :type, :leaveYear, :entitled, 0)
            on conflict do nothing""", nativeQuery = true)
    void open(String employeeId, String type, int leaveYear, BigDecimal entitled);
}
