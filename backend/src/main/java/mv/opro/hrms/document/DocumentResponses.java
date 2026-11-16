package mv.opro.hrms.document;

import java.time.LocalDate;
import java.util.Map;

// Document shapes, matching the frontend's DocumentEntry and DocumentType field for field.
public final class DocumentResponses {

    private static final String MISSING = "missing";
    private static final String EXPIRED = "expired";

    // status is missing until there's a copy, and expired once a verified one runs out.
    public record DocumentResponse(String type, String name, String uploadedBy, boolean hasExpiry, String status, LocalDate updatedOn, LocalDate expiresOn,
            String decisionNote, boolean hasFile, String employeeId, String employeeName) {

        public static DocumentResponse of(DocumentType type, EmployeeDocument document, LocalDate today, Map<String, String> names) {
            if (document == null) {
                return new DocumentResponse(type.getCode(), type.getName(), type.getUploadedBy(), type.hasExpiry(), MISSING, null, null, null, false, null,
                        null);
            }
            boolean isExpired = EmployeeDocument.VERIFIED.equals(document.getStatus()) && document.getExpiresOn() != null
                    && document.getExpiresOn().isBefore(today);
            return new DocumentResponse(type.getCode(), type.getName(), type.getUploadedBy(), type.hasExpiry(), isExpired ? EXPIRED : document.getStatus(),
                    document.getUpdatedOn(), document.getExpiresOn(), document.getDecisionNote(), document.getFileId() != null, document.getEmployeeId(),
                    names.get(document.getEmployeeId()));
        }
    }

    public record TypeResponse(String code, String name, String uploadedBy, boolean hasExpiry, boolean isForExpatriatesOnly, LocalDate retiredOn) {

        public static TypeResponse of(DocumentType type) {
            return new TypeResponse(type.getCode(), type.getName(), type.getUploadedBy(), type.hasExpiry(), type.isForExpatriatesOnly(), type.getRetiredOn());
        }
    }

    private DocumentResponses() {}
}
