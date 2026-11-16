package mv.opro.hrms.document;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.files.Files;
import mv.opro.hrms.files.Upload;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.tags.Tag;

// Someone's own documents. Nobody else's are reachable from here.
@Tag(name = "Documents", description = "Your own documents: what HR asks for, uploading yours, and downloading copies.")
@RestController
class DocumentController {

    private static final int MAX_BYTES = 5 * Upload.MEGABYTE;

    private final Documents documents;
    private final Files files;
    private final CurrentUser currentUser;
    private final Clock clock;

    DocumentController(Documents documents, Files files, CurrentUser currentUser, Clock clock) {
        this.documents = documents;
        this.files = files;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    @GetMapping("/api/documents")
    List<DocumentResponses.DocumentResponse> mine() {
        LocalDate today = LocalDate.now(clock);
        return documents.of(currentUser.get()).stream()
                .map(entry -> DocumentResponses.DocumentResponse.of(entry.type(), entry.document(), today, Map.of()))
                .toList();
    }

    // The file is the raw body. The expiry date rides along in the address, for types that expire.
    @PutMapping("/api/documents/{type}/file")
    DocumentResponses.DocumentResponse upload(@PathVariable String type, @RequestParam(required = false) LocalDate expiresOn, HttpServletRequest request) {
        Employee me = currentUser.get();
        EmployeeDocument saved = documents.upload(me, me, type, Upload.read(request, Upload.CERTIFICATE, MAX_BYTES), expiresOn);
        return DocumentResponses.DocumentResponse.of(documents.typeOf(type), saved, LocalDate.now(clock), Map.of());
    }

    @GetMapping("/api/documents/{type}/file")
    ResponseEntity<byte[]> file(@PathVariable String type) {
        return files.serve(documents.fileOf(currentUser.get(), type), documents.typeOf(type).getName(), true, CacheControl.noStore());
    }
}
