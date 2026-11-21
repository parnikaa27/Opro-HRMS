package mv.opro.hrms.document;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;
import java.util.UUID;

// One file of a document, like one page of a passport.
@Entity
public class DocumentFile {

    @Id
    private String id;

    private String documentId;
    private UUID fileId;
    private String uploadedBy;
    private LocalDate uploadedOn;

    protected DocumentFile() {}

    DocumentFile(String id, String documentId, UUID fileId, String uploadedBy, LocalDate uploadedOn) {
        this.id = id;
        this.documentId = documentId;
        this.fileId = fileId;
        this.uploadedBy = uploadedBy;
        this.uploadedOn = uploadedOn;
    }

    public String getId() {
        return id;
    }

    String getDocumentId() {
        return documentId;
    }

    UUID getFileId() {
        return fileId;
    }

    public LocalDate getUploadedOn() {
        return uploadedOn;
    }
}
