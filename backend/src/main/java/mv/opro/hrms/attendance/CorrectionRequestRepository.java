package mv.opro.hrms.attendance;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface CorrectionRequestRepository extends JpaRepository<CorrectionRequest, String> {

    List<CorrectionRequest> findByEmployeeIdOrderByRaisedOnDescPunchDateDesc(String employeeId);

    List<CorrectionRequest> findAllByOrderByRaisedOnDesc();

    List<CorrectionRequest> findByStatusOrderByRaisedOnDesc(String status);

    List<CorrectionRequest> findByEmployeeIdInOrderByRaisedOnDesc(Collection<String> employeeIds);

    List<CorrectionRequest> findByEmployeeIdInAndStatusOrderByRaisedOnDesc(Collection<String> employeeIds, String status);
}
