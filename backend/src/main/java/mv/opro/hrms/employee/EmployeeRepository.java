package mv.opro.hrms.employee;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface EmployeeRepository extends JpaRepository<Employee, String> {

    @Query("select e from Employee e where e.lastDay is null or e.lastDay >= :day order by e.fullName")
    List<Employee> findActiveOn(LocalDate day);

    // Serialises changes for one person, so two requests sent at once can't both spend the same balance.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Employee e where e.id = :id")
    Optional<Employee> lockById(String id);

    @Query("select e from Employee e where e.managerId = :managerId and (e.lastDay is null or e.lastDay >= :day) order by e.fullName")
    List<Employee> findActiveReports(String managerId, LocalDate day);

    @Query("select max(e.id) from Employee e")
    Optional<String> findHighestId();

    // People are added one at a time, so two added at once can't both take the next ID. Released when the transaction ends.
    @Query(value = "select 1 from pg_advisory_xact_lock(hashtext('employee-ids'))", nativeQuery = true)
    int lockNewIds();

    boolean existsByEmailIgnoreCaseAndIdNot(String email, String id);

    List<Employee> findAllByOrderByFullName();

    @Query("select count(e) > 0 from Employee e where e.managerId = :managerId and (e.lastDay is null or e.lastDay >= :day)")
    boolean hasActiveReports(String managerId, LocalDate day);
}
