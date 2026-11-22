package mv.opro.hrms.exit;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface ExitReturnRepository extends JpaRepository<ExitReturn, ExitReturn.Key> {

    List<ExitReturn> findByResignationId(String resignationId);
}
