package mv.opro.hrms.files;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import mv.opro.hrms.common.ApiException;
import org.springframework.http.HttpStatus;

// A file sent as the raw request body, already checked: allowed type, within the size limit, and its first bytes
// match the type it claims. A file that only says it is a PDF is turned away.
public record Upload(byte[] bytes, String contentType) {

    public static final Set<String> PHOTO = Set.of("image/jpeg");
    public static final Set<String> CERTIFICATE = Set.of("image/jpeg", "image/png", "application/pdf");
    public static final int MEGABYTE = 1024 * 1024;

    private static final Map<String, byte[]> SIGNATURES = Map.of(
            "image/jpeg", new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF},
            "image/png", new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47},
            "application/pdf", new byte[] {0x25, 0x50, 0x44, 0x46});

    public static Upload read(HttpServletRequest request, Set<String> allowed, int maxBytes) {
        String type = request.getContentType() == null ? "" : request.getContentType().split(";")[0].strip().toLowerCase(Locale.ROOT);
        if (!allowed.contains(type)) {
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "That file type isn't accepted.");
        }
        if (request.getContentLengthLong() > maxBytes) {
            throw tooLarge(maxBytes);
        }
        byte[] bytes;
        try (InputStream body = request.getInputStream()) {
            // One byte over the limit is enough to know it's too big, without reading the rest.
            bytes = body.readNBytes(maxBytes + 1);
        } catch (IOException error) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The upload didn't come through. Try again.");
        }
        if (bytes.length > maxBytes) {
            throw tooLarge(maxBytes);
        }
        byte[] signature = SIGNATURES.get(type);
        if (bytes.length < signature.length || !Arrays.equals(Arrays.copyOf(bytes, signature.length), signature)) {
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "That file type isn't accepted.");
        }
        return new Upload(bytes, type);
    }

    private static ApiException tooLarge(int maxBytes) {
        return new ApiException(HttpStatus.CONTENT_TOO_LARGE, "Files can be up to " + maxBytes / MEGABYTE + " MB.");
    }
}
