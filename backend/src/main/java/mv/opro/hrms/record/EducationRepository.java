package mv.opro.hrms.record;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface EducationRepository extends JpaRepository<Education, String> {

    List<Education> findByEmployeeIdOrderByCompletedYearDesc(String employeeId);

    Optional<Education> findByIdAndEmployeeId(String id, String employeeId);
}
