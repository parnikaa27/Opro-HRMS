package mv.opro.hrms.exit;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface ExitItemRepository extends JpaRepository<ExitItem, String> {

    List<ExitItem> findAllByOrderBySortOrderAscNameAsc();

    boolean existsByNameIgnoreCase(String name);
}
