package mv.opro.hrms.document;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface EmployeeDocumentRepository extends JpaRepository<EmployeeDocument, String> {

    List<EmployeeDocument> findByEmployeeId(String employeeId);

    Optional<EmployeeDocument> findByEmployeeIdAndTypeCode(String employeeId, String typeCode);

    List<EmployeeDocument> findByStatusOrderByUpdatedOn(String status);

    boolean existsByTypeCode(String typeCode);
}
