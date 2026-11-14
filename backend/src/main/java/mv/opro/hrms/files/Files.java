package mv.opro.hrms.files;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import mv.opro.hrms.common.ApiException;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Storing and serving files. Every file goes out with nosniff and a sandbox policy, so nothing uploaded can ever
// run as a page on our own address.
@Service
public class Files {

    private static final Map<String, String> EXTENSIONS = Map.of("image/jpeg", "jpg", "image/png", "png", "application/pdf", "pdf");

    private final StoredFileRepository files;
    private final Clock clock;

    Files(StoredFileRepository files, Clock clock) {
        this.files = files;
        this.clock = clock;
    }

    @Transactional
    public UUID store(Upload upload, String uploadedBy) {
        return files.save(StoredFile.of(upload, uploadedBy, OffsetDateTime.now(clock))).getId();
    }

    @Transactional
    public void delete(UUID id) {
        files.deleteById(id);
    }

    // inline opens in the browser (photos, a certificate in a new tab), attachment downloads (documents).
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> serve(UUID id, String name, boolean isAttachment, CacheControl cache) {
        StoredFile file = files.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "File not found"));
        ContentDisposition disposition = (isAttachment ? ContentDisposition.attachment() : ContentDisposition.inline())
                .filename(name + "." + EXTENSIONS.get(file.getContentType()))
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("Content-Security-Policy", "sandbox")
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(cache)
                .body(file.getContent());
    }
}
