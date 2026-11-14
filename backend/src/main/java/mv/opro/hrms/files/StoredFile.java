package mv.opro.hrms.files;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
public class StoredFile {

    @Id
    private UUID id;

    private String contentType;

    @Column(name = "bytes")
    private byte[] content;

    private int sizeBytes;
    private String uploadedBy;
    private OffsetDateTime uploadedAt;

    protected StoredFile() {}

    static StoredFile of(Upload upload, String uploadedBy, OffsetDateTime uploadedAt) {
        StoredFile file = new StoredFile();
        file.id = UUID.randomUUID();
        file.contentType = upload.contentType();
        file.content = upload.bytes();
        file.sizeBytes = upload.bytes().length;
        file.uploadedBy = uploadedBy;
        file.uploadedAt = uploadedAt;
        return file;
    }

    public UUID getId() {
        return id;
    }

    public String getContentType() {
        return contentType;
    }

    public byte[] getContent() {
        return content;
    }
}
