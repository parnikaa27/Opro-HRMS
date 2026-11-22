package mv.opro.hrms.common;

import jakarta.validation.ConstraintViolation;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.validation.FieldError;
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

    // The forms catch most of these first. When one gets through, it's said in words, not as a rule.
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> invalid(MethodArgumentNotValidException error) {
        String message = error.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(ApiErrors::inWords)
                .orElse("Check the details and try again.");
        return ResponseEntity.badRequest().body(new ApiError(message));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> unreadable() {
        return ResponseEntity.badRequest().body(new ApiError("Something in that wasn't filled in the right way. Check it and try again."));
    }

    // "dateOfBirth" with @Past reads "Date of birth has to be in the past."
    static String inWords(FieldError field) {
        String name = label(field.getField());
        Map<String, Object> rule = field.contains(ConstraintViolation.class)
                ? field.unwrap(ConstraintViolation.class).getConstraintDescriptor().getAttributes()
                : Map.of();
        // A rule with its own words ("has to be 6 to 40 digits") says them.
        if (rule.get("message") instanceof String own && !own.startsWith("{")) {
            return name + " " + own + ".";
        }
        return switch (field.getCode() == null ? "" : field.getCode()) {
            case "NotBlank", "NotNull", "NotEmpty" -> name + " is needed.";
            case "Size" -> field.getRejectedValue() instanceof CharSequence
                    ? name + " is too long. Keep it to " + rule.get("max") + " characters."
                    : name + " needs between " + rule.get("min") + " and " + rule.get("max") + " entries.";
            case "Pattern" -> rule.get("regexp") instanceof String choices && choices.matches("[\\w-]+(\\|[\\w-]+)+")
                    ? name + " has to be " + String.join(" or ", choices.split("\\|")) + "."
                    : name + " isn't in the right form.";
            case "Past" -> name + " has to be in the past.";
            case "Min", "DecimalMin" -> name + (Boolean.FALSE.equals(rule.get("inclusive")) ? " has to be more than " : " has to be at least ")
                    + rule.get("value") + ".";
            case "Max", "DecimalMax" -> name + " has to be at most " + rule.get("value") + ".";
            case "PositiveOrZero" -> name + " can't be below 0.";
            default -> "Check " + name.toLowerCase(Locale.ROOT) + " and try again.";
        };
    }

    // "emergencyContact.phone" reads "Emergency contact phone", "goals[0].weight" "Goals weight", "employeeId" "Employee ID".
    static String label(String path) {
        String words = path.replaceAll("\\[\\d+]", "").replace('.', ' ').replaceAll("([a-z])([A-Z])", "$1 $2")
                .toLowerCase(Locale.ROOT).replaceAll("\\bid\\b", "ID");
        return Character.toUpperCase(words.charAt(0)) + words.substring(1);
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
