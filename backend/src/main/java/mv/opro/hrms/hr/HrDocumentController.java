package mv.opro.hrms.hr;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.document.DocumentResponses;
import mv.opro.hrms.document.DocumentType;
import mv.opro.hrms.document.Documents;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.files.Files;
import mv.opro.hrms.files.Upload;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.tags.Tag;

// HR's side of documents: the list of types, everyone's copies, uploading for someone, and checking what employees send.
// HR never uploads or checks their own.
@Tag(name = "HR: documents", description = "The document list, everyone's copies, uploading for someone and checking uploads. HR only, never their own.")
@RestController
class HrDocumentController {

    private static final int MAX_BYTES = 5 * Upload.MEGABYTE;
    private static final int MAX_NOTE = 300;
    private static final int MAX_REMIND_DAYS = 365;
    private static final int DEFAULT_REMIND_DAYS = 30;

    // Reminder days and who it's for are optional: 30 days, and everyone.
    record TypeBody(@NotBlank @Size(max = 60) String name, @NotNull @Pattern(regexp = "employee|hr") String uploadedBy, @NotNull Boolean hasExpiry,
            @NotNull Boolean isForExpatriatesOnly, @Min(1) @Max(MAX_REMIND_DAYS) Integer remindDaysBefore, Boolean isForEveryone) {

        DocumentType.Rules rules() {
            return new DocumentType.Rules(name, uploadedBy, hasExpiry, isForExpatriatesOnly, remindDaysBefore == null ? DEFAULT_REMIND_DAYS : remindDaysBefore,
                    !Boolean.FALSE.equals(isForEveryone));
        }
    }

    record DecisionBody(@NotNull @Pattern(regexp = "verified|rejected") String decision, @Size(max = MAX_NOTE) String note) {}

    private final HrAccess hr;
    private final CurrentUser currentUser;
    private final HrPeople hrPeople;
    private final People people;
    private final Documents documents;
    private final Files files;
    private final Clock clock;

    HrDocumentController(HrAccess hr, CurrentUser currentUser, HrPeople hrPeople, People people, Documents documents, Files files, Clock clock) {
        this.hr = hr;
        this.currentUser = currentUser;
        this.hrPeople = hrPeople;
        this.people = people;
        this.documents = documents;
        this.files = files;
        this.clock = clock;
    }

    @GetMapping("/api/hr/document-types")
    List<DocumentResponses.TypeResponse> types() {
        hr.require(currentUser.get());
        return documents.types().stream().map(DocumentResponses.TypeResponse::of).toList();
    }

    @PostMapping("/api/hr/document-types")
    DocumentResponses.TypeResponse addType(@Valid @RequestBody TypeBody body) {
        hr.require(currentUser.get());
        return DocumentResponses.TypeResponse.of(documents.addType(body.rules()));
    }

    @PutMapping("/api/hr/document-types/{code}")
    DocumentResponses.TypeResponse changeType(@PathVariable String code, @Valid @RequestBody TypeBody body) {
        hr.require(currentUser.get());
        return DocumentResponses.TypeResponse.of(documents.updateType(code, body.rules()));
    }

    // Deleted if nobody ever uploaded one, otherwise retired with the copies kept.
    @DeleteMapping("/api/hr/document-types/{code}")
    ResponseEntity<Void> removeType(@PathVariable String code) {
        hr.require(currentUser.get());
        documents.removeType(code);
        return ResponseEntity.noContent().build();
    }

    // Uploads waiting for HR, across Opro, oldest first. Never the reader's own.
    @GetMapping("/api/hr/documents")
    List<DocumentResponses.DocumentResponse> waiting() {
        List<Documents.Entry> waiting = documents.waiting(hr.require(currentUser.get()));
        Map<String, String> names = people.namesOf(waiting.stream().map(entry -> entry.document().getEmployeeId()).collect(Collectors.toSet()));
        LocalDate today = LocalDate.now(clock);
        return waiting.stream().map(entry -> DocumentResponses.DocumentResponse.of(entry, today, names)).toList();
    }

    // Everyone still to hand something in, by name, with what's missing, sent back or expired.
    @GetMapping("/api/hr/documents/to-collect")
    List<DocumentResponses.ToCollect> toCollect() {
        hr.require(currentUser.get());
        LocalDate today = LocalDate.now(clock);
        return documents.toCollect(people.active()).entrySet().stream()
                .sorted(Comparator.comparing(entry -> entry.getKey().getFullName()))
                .map(entry -> new DocumentResponses.ToCollect(entry.getKey().getId(), entry.getKey().getFullName(), entry.getValue().stream()
                        .map(document -> DocumentResponses.DocumentResponse.of(document, today, Map.of())).toList()))
                .toList();
    }

    @GetMapping("/api/hr/employees/{id}/documents")
    List<DocumentResponses.DocumentResponse> of(@PathVariable String id) {
        hr.require(currentUser.get());
        Employee employee = hrPeople.find(id);
        return documents.of(employee).stream().map(entry -> view(entry, employee)).toList();
    }

    // Asks just this person for a type that isn't for everyone, or stops asking.
    @PostMapping("/api/hr/employees/{id}/document-types/{type}")
    ResponseEntity<Void> ask(@PathVariable String id, @PathVariable String type) {
        documents.ask(someoneElse(hr.require(currentUser.get()), id), type);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/hr/employees/{id}/document-types/{type}")
    ResponseEntity<Void> stopAsking(@PathVariable String id, @PathVariable String type) {
        documents.stopAsking(someoneElse(hr.require(currentUser.get()), id), type);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/api/hr/employees/{id}/documents/{type}/file")
    DocumentResponses.DocumentResponse upload(@PathVariable String id, @PathVariable String type, @RequestParam(required = false) LocalDate issuedOn,
            @RequestParam(required = false) LocalDate expiresOn, HttpServletRequest request) {
        Employee me = hr.require(currentUser.get());
        Employee owner = someoneElse(me, id);
        return view(documents.upload(me, owner, type, Upload.read(request, Upload.CERTIFICATE, MAX_BYTES), issuedOn, expiresOn), owner);
    }

    @GetMapping("/api/hr/employees/{id}/documents/{type}/files/{fileId}")
    ResponseEntity<byte[]> file(@PathVariable String id, @PathVariable String type, @PathVariable String fileId) {
        hr.require(currentUser.get());
        return files.serve(documents.fileOf(hrPeople.find(id), type, fileId), documents.typeOf(type).getName(), false, CacheControl.noStore());
    }

    @DeleteMapping("/api/hr/employees/{id}/documents/{type}/files/{fileId}")
    DocumentResponses.DocumentResponse removeFile(@PathVariable String id, @PathVariable String type, @PathVariable String fileId) {
        Employee me = hr.require(currentUser.get());
        Employee owner = someoneElse(me, id);
        return view(documents.removeFile(me, owner, type, fileId), owner);
    }

    @PostMapping("/api/hr/employees/{id}/documents/{type}/decision")
    DocumentResponses.DocumentResponse decide(@PathVariable String id, @PathVariable String type, @Valid @RequestBody DecisionBody body) {
        Employee me = hr.require(currentUser.get());
        Employee owner = someoneElse(me, id);
        return view(documents.decide(me, owner, type, body.decision(), body.note()), owner);
    }

    private DocumentResponses.DocumentResponse view(Documents.Entry entry, Employee owner) {
        return DocumentResponses.DocumentResponse.of(entry, LocalDate.now(clock), Map.of(owner.getId(), owner.getFullName()));
    }

    private Employee someoneElse(Employee me, String id) {
        if (id.equals(me.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Another HR person handles your own documents.");
        }
        return hrPeople.find(id);
    }
}
