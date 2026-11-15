package mv.opro.hrms.document;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface EmployeeDocumentRepository extends JpaRepository<EmployeeDocument, String> {

    List<EmployeeDocument> findByEmployeeIdOrderBySortOrder(String employeeId);

    Optional<EmployeeDocument> findByIdAndEmployeeId(String id, String employeeId);
}
