package mv.opro.hrms.attendance;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface OvertimeClaimRepository extends JpaRepository<OvertimeClaim, String> {

    boolean existsByEmployeeIdAndWorkDate(String employeeId, LocalDate workDate);

    List<OvertimeClaim> findByEmployeeIdInOrderByWorkDateDesc(Collection<String> employeeIds);

    List<OvertimeClaim> findByEmployeeIdInAndStatusOrderByWorkDateDesc(Collection<String> employeeIds, String status);

    List<OvertimeClaim> findByStatusAndHodApprovedByNotNullOrderByWorkDate(String status);
}
