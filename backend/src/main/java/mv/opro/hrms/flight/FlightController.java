package mv.opro.hrms.flight;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.files.Files;
import mv.opro.hrms.files.Upload;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// Someone's own flight allowance and claims.
@RestController
class FlightController {

    private static final int MAX_RECEIPT_BYTES = 5 * Upload.MEGABYTE;
    private static final int MAX_ROUTE = 80;

    record ClaimBody(
            @NotNull LocalDate flightDate,
            @NotBlank @Size(max = MAX_ROUTE) String route,
            @NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax("10000000") BigDecimal amount,
            @NotNull @Pattern(regexp = "USD|MVR|INR") String currency) {}

    private final Flights flights;
    private final CurrentUser currentUser;
    private final Files files;

    FlightController(Flights flights, CurrentUser currentUser, Files files) {
        this.flights = flights;
        this.currentUser = currentUser;
        this.files = files;
    }

    @GetMapping("/api/flights")
    FlightResponses.YearResponse year() {
        Employee me = currentUser.get();
        return FlightResponses.YearResponse.of(flights.yearOf(me.getId()), flights.rates(), Map.of(me.getId(), me.getFullName()));
    }

    @PostMapping("/api/flights/claims")
    FlightResponses.ClaimResponse claim(@Valid @RequestBody ClaimBody body) {
        Employee me = currentUser.get();
        FlightClaim claim = flights.claim(me, new Flights.NewClaim(body.flightDate(), body.route(), body.amount(), body.currency()));
        return FlightResponses.ClaimResponse.of(claim, Map.of(me.getId(), me.getFullName()));
    }

    @PutMapping("/api/flights/claims/{id}/receipt")
    FlightResponses.ClaimResponse attachReceipt(@PathVariable String id, HttpServletRequest request) {
        Employee me = currentUser.get();
        FlightClaim claim = flights.attachReceipt(me, id, Upload.read(request, Upload.CERTIFICATE, MAX_RECEIPT_BYTES));
        return FlightResponses.ClaimResponse.of(claim, Map.of(me.getId(), me.getFullName()));
    }

    @GetMapping("/api/flights/claims/{id}/receipt")
    ResponseEntity<byte[]> receipt(@PathVariable String id) {
        return files.serve(flights.receiptOf(currentUser.get(), id), "receipt-" + id, false, CacheControl.noStore());
    }

    @PostMapping("/api/flights/claims/{id}/cancel")
    FlightResponses.ClaimResponse cancel(@PathVariable String id) {
        Employee me = currentUser.get();
        return FlightResponses.ClaimResponse.of(flights.cancel(me, id), Map.of(me.getId(), me.getFullName()));
    }
}
