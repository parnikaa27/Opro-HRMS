package mv.opro.hrms.leave;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface LeaveRequestRepository extends JpaRepository<LeaveRequest, String> {

    List<LeaveRequest> findByEmployeeIdOrderByFromDateDesc(String employeeId);

    @Query("""
            select count(r) > 0 from LeaveRequest r
            where r.employeeId = :employeeId and r.status in ('pending', 'approved') and r.fromDate <= :to and r.toDate >= :from""")
    boolean overlaps(String employeeId, LocalDate from, LocalDate to);

    @Query("""
            select coalesce(sum(r.days), 0) from LeaveRequest r
            where r.employeeId = :employeeId and r.type = :type and r.status = :status and r.fromDate between :yearStart and :yearEnd""")
    BigDecimal daysIn(String employeeId, String type, String status, LocalDate yearStart, LocalDate yearEnd);

    @Query("""
            select r from LeaveRequest r
            where r.employeeId = :employeeId and r.status = 'approved' and r.fromDate <= :to and r.toDate >= :from""")
    List<LeaveRequest> approvedBetween(String employeeId, LocalDate from, LocalDate to);
}
