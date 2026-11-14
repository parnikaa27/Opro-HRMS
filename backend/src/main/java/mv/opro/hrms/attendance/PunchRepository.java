package mv.opro.hrms.attendance;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface PunchRepository extends JpaRepository<Punch, Long> {

    List<Punch> findByEmployeeIdAndPunchedAtGreaterThanEqualAndPunchedAtLessThanOrderByPunchedAt(String employeeId, OffsetDateTime from, OffsetDateTime to);

    boolean existsByEmployeeIdAndPunchedAt(String employeeId, OffsetDateTime punchedAt);

    boolean existsByEmployeeIdAndPunchedAtGreaterThanEqualAndPunchedAtLessThan(String employeeId, OffsetDateTime from, OffsetDateTime to);
}
