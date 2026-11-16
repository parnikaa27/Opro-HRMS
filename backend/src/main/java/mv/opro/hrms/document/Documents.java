package mv.opro.hrms.document;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.files.Files;
import mv.opro.hrms.files.Upload;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Everyone's documents, one per type on HR's list. Employees upload theirs and HR checks them; HR uploads the rest.
@Service
@Transactional(readOnly = true)
public class Documents {

    private static final String NATIONAL = "Maldivian";
    private static final int MAX_CODE_LENGTH = 40;

    // A type someone needs, and their copy if they have one.
    public record Entry(DocumentType type, EmployeeDocument document) {}

    private final DocumentTypeRepository types;
    private final EmployeeDocumentRepository documents;
    private final EmployeeRepository employees;
    private final Files files;
    private final Notifications notifications;
    private final Clock clock;

    Documents(DocumentTypeRepository types, EmployeeDocumentRepository documents, EmployeeRepository employees, Files files, Notifications notifications,
            Clock clock) {
        this.types = types;
        this.documents = documents;
        this.employees = employees;
        this.files = files;
        this.notifications = notifications;
        this.clock = clock;
    }

    public List<DocumentType> types() {
        return types.findAll(Sort.by("sortOrder", "name"));
    }

    // Every type that applies to them, plus anything they hold of a retired type. Expatriate only types skip Maldivians.
    public List<Entry> of(Employee employee) {
        Map<String, EmployeeDocument> held = documents.findByEmployeeId(employee.getId()).stream()
                .collect(Collectors.toMap(EmployeeDocument::getTypeCode, Function.identity()));
        boolean isExpatriate = !NATIONAL.equalsIgnoreCase(employee.getNationality());
        return types().stream()
                .filter(type -> held.containsKey(type.getCode()) || (!type.isRetired() && (isExpatriate || !type.isForExpatriatesOnly())))
                .map(type -> new Entry(type, held.get(type.getCode())))
                .toList();
    }

    // Uploads waiting for HR, oldest first.
    public List<EmployeeDocument> waiting() {
        return documents.findByStatusOrderByUpdatedOn(EmployeeDocument.PENDING);
    }

    // An employee's own upload waits for HR. HR's counts as verified, and the person is told.
    @Transactional
    public EmployeeDocument upload(Employee by, Employee owner, String typeCode, Upload upload, LocalDate expiresOn) {
        employees.lockById(owner.getId());
        DocumentType type = activeType(typeCode);
        boolean isOwn = by.getId().equals(owner.getId());
        if (isOwn && !type.isUploadedByEmployee()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HR adds your " + lower(type) + ".");
        }
        LocalDate today = today();
        if (type.hasExpiry() && (expiresOn == null || !expiresOn.isAfter(today))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Enter the date it expires. It has to be after today.");
        }
        EmployeeDocument document = documents.findByEmployeeIdAndTypeCode(owner.getId(), type.getCode())
                .orElseGet(() -> new EmployeeDocument(Ids.next("DOC"), owner.getId(), type.getCode()));
        UUID previous = document.upload(files.store(upload, by.getId()), by.getId(), today, type.hasExpiry() ? expiresOn : null, !isOwn);
        documents.save(document);
        if (previous != null) {
            files.delete(previous);
        }
        if (!isOwn) {
            notifications.tell(owner.getId(), Notification.Kind.RECORD, "HR added your " + lower(type) + ".");
        }
        return document;
    }

    // Sending one back needs a reason, so they know what to fix.
    @Transactional
    public EmployeeDocument decide(Employee hr, Employee owner, String typeCode, String decision, String note) {
        EmployeeDocument document = held(owner, typeCode);
        if (!document.isPending()) {
            throw new ApiException(HttpStatus.CONFLICT, "This document has already been checked.");
        }
        String cleanNote = note == null || note.isBlank() ? null : note.strip();
        boolean isVerified = EmployeeDocument.VERIFIED.equals(decision);
        if (!isVerified && cleanNote == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Say what's wrong, so they can send the right one.");
        }
        document.decide(decision, hr.getId(), today(), cleanNote);
        String name = lower(typeOf(typeCode));
        notifications.tell(owner.getId(), Notification.Kind.RECORD, isVerified
                ? "HR verified your " + name + "."
                : "HR sent back your " + name + ": " + Wording.sentence(cleanNote) + " Upload it again from Documents.");
        return document;
    }

    public UUID fileOf(Employee owner, String typeCode) {
        UUID file = held(owner, typeCode).getFileId();
        if (file == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "There's no file for this yet.");
        }
        return file;
    }

    public DocumentType typeOf(String code) {
        return types.findById(code).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document type not found"));
    }

    @Transactional
    public DocumentType addType(DocumentType.Rules rules) {
        String code = Ids.codeFor(rules.name(), MAX_CODE_LENGTH);
        if (code.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Give the document a name with letters or numbers.");
        }
        if (types.existsById(code)) {
            throw new ApiException(HttpStatus.CONFLICT, "There's already a document called that.");
        }
        checkName(rules.name(), code);
        int sortOrder = types().stream().mapToInt(DocumentType::getSortOrder).max().orElse(0) + 1;
        return types.save(new DocumentType(code, sortOrder, rules));
    }

    @Transactional
    public DocumentType updateType(String code, DocumentType.Rules rules) {
        DocumentType type = activeType(code);
        checkName(rules.name(), code);
        type.change(rules);
        return type;
    }

    // Never used, it's deleted. Used, it's retired: nobody is asked for it, and copies on file stay.
    @Transactional
    public void removeType(String code) {
        DocumentType type = activeType(code);
        if (documents.existsByTypeCode(code)) {
            type.retire(today());
        } else {
            types.delete(type);
        }
    }

    private void checkName(String name, String code) {
        boolean isTaken = types().stream().anyMatch(type -> !type.isRetired() && !type.getCode().equals(code) && type.getName().equalsIgnoreCase(name.strip()));
        if (isTaken) {
            throw new ApiException(HttpStatus.CONFLICT, "There's already a document called that.");
        }
    }

    private DocumentType activeType(String code) {
        return types.findById(code).filter(type -> !type.isRetired())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document type not found"));
    }

    private EmployeeDocument held(Employee owner, String typeCode) {
        return documents.findByEmployeeIdAndTypeCode(owner.getId(), typeCode)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document not found"));
    }

    // "Passport copy" reads as "passport copy" mid sentence.
    private static String lower(DocumentType type) {
        return type.getName().toLowerCase(Locale.ROOT);
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}
