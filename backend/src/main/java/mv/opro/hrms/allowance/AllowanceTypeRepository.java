package mv.opro.hrms.allowance;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface AllowanceTypeRepository extends JpaRepository<AllowanceType, String> {

    List<AllowanceType> findAllByOrderBySortOrderAscNameAsc();
}
