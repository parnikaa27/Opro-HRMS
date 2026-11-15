package mv.opro.hrms.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

// Every error leaves as {"message": "..."}, the shape the frontend reads. Nothing internal is ever sent.
@RestControllerAdvice
class ApiErrors {

    private static final Logger log = LoggerFactory.getLogger(ApiErrors.class);

    record ApiError(String message) {}

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> refused(ApiException error) {
        return ResponseEntity.status(error.status()).body(new ApiError(error.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> invalid(MethodArgumentNotValidException error) {
        String message = error.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(field -> field.getField() + " " + field.getDefaultMessage())
                .orElse("Check the details and try again");
        return ResponseEntity.badRequest().body(new ApiError(message));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> unreadable() {
        return ResponseEntity.badRequest().body(new ApiError("Body must be JSON"));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception error) {
        // Spring's own request errors (no such endpoint, wrong method) keep their status. They aren't our failures.
        if (error instanceof ErrorResponse request) {
            HttpStatusCode status = request.getStatusCode();
            return ResponseEntity.status(status).body(new ApiError(status.value() == HttpStatus.NOT_FOUND.value() ? "No such endpoint" : "That request isn't supported"));
        }
        log.error("Unhandled error", error);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ApiError("Something went wrong on our side"));
    }
}
