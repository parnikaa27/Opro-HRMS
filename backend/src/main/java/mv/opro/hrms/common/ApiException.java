package mv.opro.hrms.common;

import org.springframework.http.HttpStatus;

// A refusal the person can act on. The message is shown in the portal, so it is written for them.
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
