package mv.opro.hrms.hr;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.files.Files;
import mv.opro.hrms.flight.FlightClaim;
import mv.opro.hrms.flight.FlightResponses;
import mv.opro.hrms.flight.Flights;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// HR's side of flight allowances: everyone's claims, each person's allowance, and the exchange rates.
// Like leave, HR never decides or sets anything for themselves.
@RestController
class HrFlightController {

    private static final int MAX_NOTE = 300;
    private static final int FIRST_YEAR = 2020;
    private static final int LAST_YEAR = 2100;

    record DecisionBody(@NotNull @Pattern(regexp = "approved|rejected") String decision, @Size(max = MAX_NOTE) String note) {}

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

    @GetMapping("/api/hr/flight-claims")
    List<FlightResponses.ClaimResponse> claims(@RequestParam(required = false) String status) {
        hr.require(currentUser.get());
        List<FlightClaim> claims = flights.all(status);
        Map<String, String> names = people.namesOf(claims.stream()
                .flatMap(claim -> Stream.of(claim.getEmployeeId(), claim.getDecidedBy()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        return claims.stream().map(claim -> FlightResponses.ClaimResponse.of(claim, names)).toList();
    }

    @PostMapping("/api/hr/flight-claims/{id}/decision")
    FlightResponses.ClaimResponse decide(@PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = hr.require(currentUser.get());
        Set<String> everyoneBut = people.active().stream().map(Employee::getId).filter(employeeId -> !employeeId.equals(me.getId()))
                .collect(Collectors.toUnmodifiableSet());
        FlightClaim claim = flights.decide(me, id, everyoneBut, body.decision(), body.note());
        return FlightResponses.ClaimResponse.of(claim, people.namesOf(Set.of(claim.getEmployeeId(), me.getId())));
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
