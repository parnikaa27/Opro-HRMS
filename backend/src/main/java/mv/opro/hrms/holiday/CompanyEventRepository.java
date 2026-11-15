package mv.opro.hrms.holiday;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface CompanyEventRepository extends JpaRepository<CompanyEvent, String> {

    List<CompanyEvent> findByEventDateBetweenOrderByEventDate(LocalDate from, LocalDate to);
}
