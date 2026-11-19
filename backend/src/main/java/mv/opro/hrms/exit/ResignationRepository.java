package mv.opro.hrms.exit;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface ResignationRepository extends JpaRepository<Resignation, String> {

    List<Resignation> findByEmployeeIdOrderBySubmittedOnDescIdDesc(String employeeId);

    List<Resignation> findByEmployeeIdInOrderBySubmittedOnDesc(Collection<String> employeeIds);

    List<Resignation> findByEmployeeIdInAndStatusOrderBySubmittedOnDesc(Collection<String> employeeIds, String status);

    List<Resignation> findByStatusAndHodApprovedOnNotNullOrderBySubmittedOn(String status);

    Optional<Resignation> findFirstByEmployeeIdAndStatus(String employeeId, String status);

    boolean existsByEmployeeIdAndStatusIn(String employeeId, Collection<String> statuses);
}
