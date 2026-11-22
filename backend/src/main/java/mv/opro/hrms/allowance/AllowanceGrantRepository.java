package mv.opro.hrms.allowance;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface AllowanceGrantRepository extends JpaRepository<AllowanceGrant, String> {

    List<AllowanceGrant> findByEmployeeIdOrderByGrantedOnDescIdDesc(String employeeId);

    List<AllowanceGrant> findByEmployeeIdInOrderByGrantedOnDescIdDesc(Collection<String> employeeIds);

    List<AllowanceGrant> findByStatusOrderByGrantedOn(String status);

    boolean existsByTypeCode(String typeCode);
}
