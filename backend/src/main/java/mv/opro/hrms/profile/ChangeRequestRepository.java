package mv.opro.hrms.profile;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface ChangeRequestRepository extends JpaRepository<ChangeRequest, String> {

    List<ChangeRequest> findAllByOrderByRaisedOnDescIdDesc();
}
