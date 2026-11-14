package mv.opro.hrms.employee;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface EmployeeRepository extends JpaRepository<Employee, String> {

    @Query("select e from Employee e where e.lastDay is null or e.lastDay >= :day order by e.fullName")
    List<Employee> findActiveOn(LocalDate day);

    @Query("select count(e) > 0 from Employee e where e.managerId = :managerId and (e.lastDay is null or e.lastDay >= :day)")
    boolean hasActiveReports(String managerId, LocalDate day);
}
