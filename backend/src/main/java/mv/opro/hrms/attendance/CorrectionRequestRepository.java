package mv.opro.hrms.attendance;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface CorrectionRequestRepository extends JpaRepository<CorrectionRequest, String> {

    List<CorrectionRequest> findByEmployeeIdOrderByRaisedOnDescPunchDateDesc(String employeeId);
}
