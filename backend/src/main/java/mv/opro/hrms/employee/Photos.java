package mv.opro.hrms.employee;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.files.Files;
import mv.opro.hrms.files.Upload;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// ID card photos. HR puts them up; anyone signed in can see a colleague's face.
@Service
@Transactional(readOnly = true)
public class Photos {

    private static final int VERSION_BYTES = 4;
    private static final Duration A_YEAR = Duration.ofDays(365);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final EmployeePhotoRepository photos;
    private final Files files;

    Photos(EmployeePhotoRepository photos, Files files) {
        this.photos = photos;
        this.files = files;
    }

    public Optional<String> urlOf(String employeeId) {
        return photos.findById(employeeId).map(photo -> "/api/employees/" + employeeId + "/photo?v=" + photo.getVersion());
    }

    // A new photo replaces the old one, and the old file goes with it.
    @Transactional
    public void replace(String employeeId, Upload upload, String uploadedBy) {
        Optional<EmployeePhoto> old = photos.findById(employeeId);
        UUID fileId = files.store(upload, uploadedBy);
        byte[] version = new byte[VERSION_BYTES];
        RANDOM.nextBytes(version);
        photos.save(new EmployeePhoto(employeeId, fileId, HexFormat.of().formatHex(version)));
        old.ifPresent(photo -> files.delete(photo.getFileId()));
    }

    @Transactional
    public void remove(String employeeId) {
        photos.findById(employeeId).ifPresent(photo -> {
            photos.delete(photo);
            files.delete(photo.getFileId());
        });
    }

    public ResponseEntity<byte[]> serve(String employeeId) {
        EmployeePhoto photo = photos.findById(employeeId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No photo"));
        // The URL changes with every new photo, so the browser may keep this one for good.
        return files.serve(photo.getFileId(), employeeId + "-photo", false, CacheControl.maxAge(A_YEAR).cachePrivate().immutable());
    }
}
