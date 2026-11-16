package mv.opro.hrms.hr;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.files.Files;
import mv.opro.hrms.flight.FlightResponses;
import mv.opro.hrms.flight.Flights;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.tags.Tag;

// HR's side of flight allowances: each person's allowance and claims, and the exchange rates. Claims need no approval.
// HR never sets their own allowance.
@Tag(name = "HR: flights", description = "Allowances, receipts and exchange rates. HR only, never their own allowance.")
@RestController
class HrFlightController {

    private static final int FIRST_YEAR = 2020;
    private static final int LAST_YEAR = 2100;

    record AllowanceBody(@NotNull @Min(FIRST_YEAR) @Max(LAST_YEAR) Integer year, @NotNull @DecimalMin("0") @DecimalMax("1000000") BigDecimal amountUsd) {}

    record RatesBody(@NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal mvr, @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal inr) {}

    private final HrAccess hr;
    private final CurrentUser currentUser;
    private final People people;
    private final HrPeople hrPeople;
    private final Flights flights;
    private final Files files;

    HrFlightController(HrAccess hr, CurrentUser currentUser, People people, HrPeople hrPeople, Flights flights, Files files) {
        this.hr = hr;
        this.currentUser = currentUser;
        this.people = people;
        this.hrPeople = hrPeople;
        this.flights = flights;
        this.files = files;
    }

    @GetMapping("/api/hr/flight-claims/{id}/receipt")
    ResponseEntity<byte[]> receipt(@PathVariable String id) {
        hr.require(currentUser.get());
        return files.serve(flights.receiptOfAnyone(id), "receipt-" + id, false, CacheControl.noStore());
    }

    @GetMapping("/api/hr/employees/{id}/flights")
    FlightResponses.YearResponse year(@PathVariable String id) {
        hr.require(currentUser.get());
        Employee employee = hrPeople.find(id);
        Flights.Year year = flights.yearOf(employee.getId());
        Map<String, String> names = people.namesOf(year.claims().stream()
                .flatMap(claim -> Stream.of(claim.getEmployeeId(), claim.getDecidedBy()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        return FlightResponses.YearResponse.of(year, flights.rates(), names);
    }

    @PutMapping("/api/hr/employees/{id}/flight-allowance")
    ResponseEntity<Void> setAllowance(@PathVariable String id, @Valid @RequestBody AllowanceBody body) {
        Employee me = hr.require(currentUser.get());
        if (id.equals(me.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Another HR person sets your own allowance.");
        }
        flights.setAllowance(me, hrPeople.find(id).getId(), body.year(), body.amountUsd());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/api/hr/exchange-rates")
    Map<String, BigDecimal> rates(@Valid @RequestBody RatesBody body) {
        Employee me = hr.require(currentUser.get());
        return flights.setRates(me, Map.of("MVR", body.mvr(), "INR", body.inr()));
    }
}
