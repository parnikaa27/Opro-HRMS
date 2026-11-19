package mv.opro.hrms.document;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface DocumentTypePersonRepository extends JpaRepository<DocumentTypePerson, DocumentTypePerson.Key> {

    List<DocumentTypePerson> findByEmployeeId(String employeeId);
}
