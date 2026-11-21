package mv.opro.hrms.document;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

// Document shapes, matching the frontend's DocumentEntry and DocumentType field for field.
public final class DocumentResponses {

    private static final String MISSING = "missing";
    private static final String EXPIRED = "expired";

    public record FileResponse(String id, LocalDate uploadedOn) {}

    // status is missing until there's a copy, and expired once a verified one runs out. isForEveryone false means HR
    // asked just this person for it.
    public record DocumentResponse(String type, String name, String uploadedBy, boolean hasExpiry, boolean isForEveryone, String status,
            LocalDate updatedOn, LocalDate issuedOn, LocalDate expiresOn, String decisionNote, List<FileResponse> files, String employeeId,
            String employeeName) {

        public static DocumentResponse of(Documents.Entry entry, LocalDate today, Map<String, String> names) {
            DocumentType type = entry.type();
            EmployeeDocument document = entry.document();
            if (document == null) {
                return new DocumentResponse(type.getCode(), type.getName(), type.getUploadedBy(), type.hasExpiry(), type.isForEveryone(), MISSING, null, null,
                        null, null, List.of(), null, null);
            }
            boolean isExpired = document.isVerified() && document.getExpiresOn() != null && document.getExpiresOn().isBefore(today);
            return new DocumentResponse(type.getCode(), type.getName(), type.getUploadedBy(), type.hasExpiry(), type.isForEveryone(),
                    isExpired ? EXPIRED : document.getStatus(), document.getUpdatedOn(), document.getIssuedOn(), document.getExpiresOn(),
                    document.getDecisionNote(), entry.files().stream().map(file -> new FileResponse(file.getId(), file.getUploadedOn())).toList(),
                    document.getEmployeeId(), names.get(document.getEmployeeId()));
        }
    }

    public record TypeResponse(String code, String name, String uploadedBy, boolean hasExpiry, boolean isForExpatriatesOnly, int remindDaysBefore,
            boolean isForEveryone, LocalDate retiredOn) {

        public static TypeResponse of(DocumentType type) {
            return new TypeResponse(type.getCode(), type.getName(), type.getUploadedBy(), type.hasExpiry(), type.isForExpatriatesOnly(),
                    type.getRemindDaysBefore(), type.isForEveryone(), type.getRetiredOn());
        }
    }

    // One person and what they still have to hand in.
    public record ToCollect(String employeeId, String employeeName, List<DocumentResponse> documents) {}

    private DocumentResponses() {}
}
