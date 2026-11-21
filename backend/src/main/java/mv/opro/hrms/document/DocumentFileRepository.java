package mv.opro.hrms.document;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface DocumentFileRepository extends JpaRepository<DocumentFile, String> {

    List<DocumentFile> findByDocumentIdInOrderByUploadedOnAscIdAsc(Collection<String> documentIds);
}
