package mv.opro.hrms.leave;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface LeaveTypeRepository extends JpaRepository<LeaveType, String> {

    List<LeaveType> findAllByOrderBySortOrder();
}
