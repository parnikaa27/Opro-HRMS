package mv.opro.hrms.record;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface WorkExperienceRepository extends JpaRepository<WorkExperience, String> {

    List<WorkExperience> findByEmployeeIdOrderByFromDateDesc(String employeeId);

    Optional<WorkExperience> findByIdAndEmployeeId(String id, String employeeId);
}
