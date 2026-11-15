package mv.opro.hrms.attendance;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface PunchEditRepository extends JpaRepository<PunchEdit, String> {

    List<PunchEdit> findByEmployeeIdAndPunchDateBetweenOrderByMadeOnDescIdDesc(String employeeId, LocalDate from, LocalDate to);
}
