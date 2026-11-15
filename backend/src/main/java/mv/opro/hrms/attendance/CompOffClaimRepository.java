package mv.opro.hrms.attendance;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface CompOffClaimRepository extends JpaRepository<CompOffClaim, String> {

    boolean existsByEmployeeIdAndWorkDate(String employeeId, LocalDate workDate);

    List<CompOffClaim> findByEmployeeIdInOrderByWorkDateDesc(Collection<String> employeeIds);

    List<CompOffClaim> findByEmployeeIdInAndStatusOrderByWorkDateDesc(Collection<String> employeeIds, String status);


}
