package mv.opro.hrms.attendance;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface HomeDayRepository extends JpaRepository<HomeDay, String> {

    Optional<HomeDay> findByEmployeeIdAndWorkDate(String employeeId, LocalDate workDate);

    List<HomeDay> findByEmployeeIdAndWorkDateBetween(String employeeId, LocalDate from, LocalDate to);

    List<HomeDay> findByEmployeeIdInOrderByWorkDateDesc(Collection<String> employeeIds);

    List<HomeDay> findByEmployeeIdInAndStatusOrderByWorkDateDesc(Collection<String> employeeIds, String status);

    List<HomeDay> findAllByOrderByWorkDateDesc();

    List<HomeDay> findByStatusOrderByWorkDateDesc(String status);
}
