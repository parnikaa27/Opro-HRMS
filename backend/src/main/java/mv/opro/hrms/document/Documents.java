package mv.opro.hrms.document;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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

// Everyone's documents, one per type on HR's list, each with one or more files. Employees upload theirs and HR
// checks them; HR uploads the rest.
@Service
@Transactional(readOnly = true)
public class Documents {

    private static final String NATIONAL = "Maldivian";
    private static final int MAX_CODE_LENGTH = 40;

    // A type someone needs, their copy if they have one, and its files.
    public record Entry(DocumentType type, EmployeeDocument document, List<DocumentFile> files) {}

    // A verified copy that runs out, for reminders.
    public record Expiring(String employeeId, String typeCode, String name, LocalDate expiresOn, int remindDaysBefore) {}

    private final DocumentTypeRepository types;
    private final EmployeeDocumentRepository documents;
    private final DocumentFileRepository documentFiles;
    private final DocumentTypePersonRepository asked;
    private final EmployeeRepository employees;
    private final Files files;
    private final Notifications notifications;
    private final Clock clock;

    Documents(DocumentTypeRepository types, EmployeeDocumentRepository documents, DocumentFileRepository documentFiles, DocumentTypePersonRepository asked,
            EmployeeRepository employees, Files files, Notifications notifications, Clock clock) {
        this.types = types;
        this.documents = documents;
        this.documentFiles = documentFiles;
        this.asked = asked;
        this.employees = employees;
        this.files = files;
        this.notifications = notifications;
        this.clock = clock;
    }

    public List<DocumentType> types() {
        return types.findAll(Sort.by("sortOrder", "name"));
    }

    // Every type that applies to them, plus anything they hold of a retired type or one they're no longer asked for.
    // Expatriate only types skip Maldivians. Types not for everyone only reach the people HR asks.
    public List<Entry> of(Employee employee) {
        Map<String, EmployeeDocument> held = documents.findByEmployeeId(employee.getId()).stream()
                .collect(Collectors.toMap(EmployeeDocument::getTypeCode, Function.identity()));
        Map<String, List<DocumentFile>> filesOf = filesOf(held.values());
        Set<String> askedFor = askedFor(employee.getId());
        return types().stream()
                .filter(type -> held.containsKey(type.getCode()) || applies(type, employee, askedFor))
                .map(type -> {
                    EmployeeDocument document = held.get(type.getCode());
                    return new Entry(type, document, document == null ? List.of() : filesOf.getOrDefault(document.getId(), List.of()));
                })
                .toList();
    }

    // Uploads waiting for HR, oldest first. Never the reader's own: another HR person checks those.
    public List<Entry> waiting(Employee hr) {
        List<EmployeeDocument> waiting = documents.findByStatusOrderByUpdatedOn(EmployeeDocument.PENDING).stream()
                .filter(document -> !document.getEmployeeId().equals(hr.getId()))
                .toList();
        Map<String, List<DocumentFile>> filesOf = filesOf(waiting);
        return waiting.stream().map(document -> new Entry(typeOf(document.getTypeCode()), document, filesOf.getOrDefault(document.getId(), List.of()))).toList();
    }

    // What each person still has to hand in: missing, sent back or expired. Only types that apply to them.
    public Map<Employee, List<Entry>> toCollect(Collection<Employee> people) {
        LocalDate today = today();
        return people.stream()
                .collect(Collectors.toMap(Function.identity(), person -> of(person).stream()
                        .filter(entry -> entry.type().getRetiredOn() == null && isOutstanding(entry.document(), today))
                        .toList()))
                .entrySet().stream()
                .filter(entry -> !entry.getValue().isEmpty())
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    // Verified copies that run out, for the daily reminders.
    public List<Expiring> expiring() {
        Map<String, DocumentType> byCode = types().stream().collect(Collectors.toMap(DocumentType::getCode, Function.identity()));
        return documents.findByStatusAndExpiresOnNotNull(EmployeeDocument.VERIFIED).stream()
                .map(document -> {
                    DocumentType type = byCode.get(document.getTypeCode());
                    return new Expiring(document.getEmployeeId(), type.getCode(), type.getName(), document.getExpiresOn(), type.getRemindDaysBefore());
                })
                .toList();
    }

    // One file at a time. Every copy has a start date, and one that expires an end date after today. A file with the
    // same dates is another page of the copy on file; new dates make a new copy, which replaces the old files.
    // An employee's upload waits for HR. HR's counts as verified, and the person is told.
    @Transactional
    public Entry upload(Employee by, Employee owner, String typeCode, Upload upload, LocalDate issuedOn, LocalDate expiresOn) {
        employees.lockById(owner.getId());
        DocumentType type = activeType(typeCode);
        boolean isOwn = by.getId().equals(owner.getId());
        if (isOwn && (!type.isUploadedByEmployee() || !applies(type, owner, askedFor(owner.getId())))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HR adds your " + lower(type) + ".");
        }
        LocalDate today = today();
        if (issuedOn == null || issuedOn.isAfter(today)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Enter the date it starts. It can't be after today.");
        }
        if (type.hasExpiry() && (expiresOn == null || !expiresOn.isAfter(today))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Enter the date it expires. It has to be after today.");
        }
        LocalDate expires = type.hasExpiry() ? expiresOn : null;
        EmployeeDocument document = documents.findByEmployeeIdAndTypeCode(owner.getId(), type.getCode())
                .orElseGet(() -> new EmployeeDocument(Ids.next("DOC"), owner.getId(), type.getCode()));
        List<DocumentFile> replaced = document.isSameCopy(issuedOn, expires) ? List.of() : filesOf(List.of(document)).getOrDefault(document.getId(), List.of());
        document.upload(by.getId(), today, issuedOn, expires, !isOwn);
        documents.save(document);
        documentFiles.save(new DocumentFile(Ids.next("DF"), document.getId(), files.store(upload, by.getId()), by.getId(), today));
        replaced.forEach(this::delete);
        if (!isOwn) {
            notifications.tell(owner.getId(), Notification.Kind.RECORD, "HR added your " + lower(type) + ".");
        }
        return entryOf(owner, type);
    }

    // A wrong file comes off with its cross. Someone can take their own off until HR has verified the copy; HR can
    // take any off. The last file going takes the copy with it.
    @Transactional
    public Entry removeFile(Employee by, Employee owner, String typeCode, String fileId) {
        employees.lockById(owner.getId());
        EmployeeDocument document = held(owner, typeCode);
        DocumentFile file = fileIn(document, fileId);
        if (by.getId().equals(owner.getId()) && document.isVerified()) {
            throw new ApiException(HttpStatus.CONFLICT, "HR has verified this, so ask HR to take a file off.");
        }
        delete(file);
        if (filesOf(List.of(document)).getOrDefault(document.getId(), List.of()).isEmpty()) {
            documents.delete(document);
        }
        return entryOf(owner, typeOf(typeCode));
    }

    // Sending one back needs a reason, so they know what to fix.
    @Transactional
    public Entry decide(Employee hr, Employee owner, String typeCode, String decision, String note) {
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
        return entryOf(owner, typeOf(typeCode));
    }

    // HR asks one person for a type that isn't for everyone. They're told when it's theirs to upload.
    @Transactional
    public void ask(Employee owner, String typeCode) {
        DocumentType type = activeType(typeCode);
        if (type.isForEveryone()) {
            throw new ApiException(HttpStatus.CONFLICT, "Everyone is already asked for " + lower(type) + ".");
        }
        if (askedFor(owner.getId()).contains(typeCode)) {
            throw new ApiException(HttpStatus.CONFLICT, "They're already asked for " + lower(type) + ".");
        }
        asked.save(new DocumentTypePerson(typeCode, owner.getId()));
        if (type.isUploadedByEmployee()) {
            notifications.tell(owner.getId(), Notification.Kind.RECORD, "HR asked for your " + lower(type) + ". Upload it from Documents.");
        }
    }

    // Stops asking. A copy already on file stays.
    @Transactional
    public void stopAsking(Employee owner, String typeCode) {
        DocumentTypePerson.Key key = new DocumentTypePerson.Key(typeCode, owner.getId());
        if (!asked.existsById(key)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "They aren't asked for that document.");
        }
        asked.deleteById(key);
    }

    public UUID fileOf(Employee owner, String typeCode, String fileId) {
        return fileIn(held(owner, typeCode), fileId).getFileId();
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
            asked.deleteAll(asked.findAll().stream().filter(person -> person.getTypeCode().equals(code)).toList());
            types.delete(type);
        }
    }

    private static boolean applies(DocumentType type, Employee employee, Set<String> askedFor) {
        if (type.isRetired()) {
            return false;
        }
        boolean isExpatriate = !NATIONAL.equalsIgnoreCase(employee.getNationality());
        return type.isForEveryone() ? isExpatriate || !type.isForExpatriatesOnly() : askedFor.contains(type.getCode());
    }

    private static boolean isOutstanding(EmployeeDocument document, LocalDate today) {
        return document == null || EmployeeDocument.REJECTED.equals(document.getStatus())
                || (document.isVerified() && document.getExpiresOn() != null && document.getExpiresOn().isBefore(today));
    }

    private Set<String> askedFor(String employeeId) {
        return asked.findByEmployeeId(employeeId).stream().map(DocumentTypePerson::getTypeCode).collect(Collectors.toSet());
    }

    private Map<String, List<DocumentFile>> filesOf(Collection<EmployeeDocument> held) {
        return documentFiles.findByDocumentIdInOrderByUploadedOnAscIdAsc(held.stream().map(EmployeeDocument::getId).toList()).stream()
                .collect(Collectors.groupingBy(DocumentFile::getDocumentId));
    }

    private Entry entryOf(Employee owner, DocumentType type) {
        EmployeeDocument document = documents.findByEmployeeIdAndTypeCode(owner.getId(), type.getCode()).orElse(null);
        return new Entry(type, document, document == null ? List.of() : filesOf(List.of(document)).getOrDefault(document.getId(), List.of()));
    }

    private DocumentFile fileIn(EmployeeDocument document, String fileId) {
        return documentFiles.findById(fileId).filter(file -> file.getDocumentId().equals(document.getId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "File not found"));
    }

    private void delete(DocumentFile file) {
        documentFiles.delete(file);
        documentFiles.flush();
        files.delete(file.getFileId());
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
