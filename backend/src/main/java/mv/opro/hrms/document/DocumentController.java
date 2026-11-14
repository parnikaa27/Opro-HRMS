package mv.opro.hrms.document;

import java.time.LocalDate;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.files.Files;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

// Someone's own documents. Nobody else's are reachable from here.
@RestController
class DocumentController {

    record DocumentResponse(String id, String name, String status, LocalDate updatedOn, LocalDate expiresOn) {}

    private final EmployeeDocumentRepository documents;
    private final Files files;
    private final CurrentUser currentUser;

    DocumentController(EmployeeDocumentRepository documents, Files files, CurrentUser currentUser) {
        this.documents = documents;
        this.files = files;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/documents")
    List<DocumentResponse> mine() {
        return documents.findByEmployeeIdOrderBySortOrder(currentUser.get().getId()).stream()
                .map(document -> new DocumentResponse(document.getId(), document.getName(), document.getStatus(), document.getUpdatedOn(),
                        document.getExpiresOn()))
                .toList();
    }

    @GetMapping("/api/documents/{id}/file")
    ResponseEntity<byte[]> file(@PathVariable String id) {
        EmployeeDocument document = documents.findByIdAndEmployeeId(id, currentUser.get().getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document not found"));
        if (document.getFileId() == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "HR hasn't added the file yet.");
        }
        return files.serve(document.getFileId(), document.getName(), true, CacheControl.noStore());
    }
}
