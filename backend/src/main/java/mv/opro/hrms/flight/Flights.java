package mv.opro.hrms.flight;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.files.Files;
import mv.opro.hrms.files.Upload;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Each person's yearly flight allowance and the flights they claim against it. Everything is counted in USD;
// a claim in MVR or INR is converted at HR's rate on the day it's made, and that number stays.
@Service
@Transactional(readOnly = true)
public class Flights {

    public static final String USD = "USD";
    private static final String APPROVED = "approved";
    private static final int CENTS = 2;

    // One person's year: what they get, what they've claimed, and every claim.
    public record Year(int year, BigDecimal allowanceUsd, BigDecimal usedUsd, List<FlightClaim> claims) {}

    public record NewClaim(LocalDate flightDate, String route, BigDecimal amount, String currency) {}

    private final FlightAllowanceRepository allowances;
    private final FlightClaimRepository claims;
    private final ExchangeRateRepository rates;
    private final EmployeeRepository employees;
    private final Files files;
    private final Notifications notifications;
    private final Clock clock;

    Flights(FlightAllowanceRepository allowances, FlightClaimRepository claims, ExchangeRateRepository rates, EmployeeRepository employees, Files files,
            Notifications notifications, Clock clock) {
        this.allowances = allowances;
        this.claims = claims;
        this.rates = rates;
        this.employees = employees;
        this.files = files;
        this.notifications = notifications;
        this.clock = clock;
    }

    // MVR and INR per USD.
    public Map<String, BigDecimal> rates() {
        return rates.findAll().stream().collect(Collectors.toMap(ExchangeRate::getCurrency, ExchangeRate::getPerUsd));
    }

    public Year yearOf(String employeeId) {
        int year = today().getYear();
        BigDecimal allowance = allowances.findById(new FlightAllowance.Key(employeeId, year)).map(FlightAllowance::getAmountUsd).orElse(null);
        return new Year(year, allowance, total(employeeId, year), claims.findByEmployeeIdOrderByFlightDateDescIdDesc(employeeId));
    }

    // A claim counts against the year of the flight and is approved as it's made, as long as it fits in what's left.
    @Transactional
    public FlightClaim claim(Employee employee, NewClaim claim) {
        employees.lockById(employee.getId());
        int year = claim.flightDate().getYear();
        BigDecimal allowance = allowances.findById(new FlightAllowance.Key(employee.getId(), year)).map(FlightAllowance::getAmountUsd)
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "You don't have a flight allowance for " + year + ". Ask HR about it."));
        BigDecimal usd = toUsd(claim.amount(), claim.currency());
        BigDecimal left = allowance.subtract(total(employee.getId(), year));
        if (usd.compareTo(left) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "That's " + dollars(usd) + ", more than the " + dollars(left.max(BigDecimal.ZERO))
                    + " you have left for " + year + ".");
        }
        return claims.save(new FlightClaim(Ids.next("FC"), employee.getId(), claim.flightDate(), claim.route().strip(), claim.amount(), claim.currency(),
                usd, today()));
    }

    @Transactional
    public FlightClaim attachReceipt(Employee employee, String id, Upload upload) {
        FlightClaim claim = own(employee, id);
        if (!claim.isApproved()) {
            throw new ApiException(HttpStatus.CONFLICT, "Receipts go on claims that still count.");
        }
        UUID previous = claim.attachReceipt(files.store(upload, employee.getId()));
        if (previous != null) {
            files.delete(previous);
        }
        return claim;
    }

    @Transactional
    public FlightClaim cancel(Employee employee, String id) {
        FlightClaim claim = own(employee, id);
        if (!claim.isApproved()) {
            throw new ApiException(HttpStatus.CONFLICT, "This claim is already off your allowance.");
        }
        claim.cancel();
        return claim;
    }

    public UUID receiptOf(Employee employee, String id) {
        return receipt(own(employee, id));
    }

    public UUID receiptOfAnyone(String id) {
        return receipt(claims.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Claim not found")));
    }

    // Never below what's already claimed for that year.
    @Transactional
    public void setAllowance(Employee hr, String employeeId, int year, BigDecimal amountUsd) {
        employees.lockById(employeeId);
        BigDecimal claimed = total(employeeId, year);
        if (amountUsd.compareTo(claimed) < 0) {
            throw new ApiException(HttpStatus.CONFLICT, "They've already claimed " + dollars(claimed) + " for " + year + ", so it can't go below that.");
        }
        FlightAllowance allowance = allowances.findById(new FlightAllowance.Key(employeeId, year))
                .orElseGet(() -> allowances.save(new FlightAllowance(employeeId, year)));
        allowance.set(amountUsd, hr.getId(), today());
        notifications.tell(employeeId, Notification.Kind.FLIGHT, "HR set your flight allowance for " + year + " to " + dollars(amountUsd) + ".");
    }

    @Transactional
    public Map<String, BigDecimal> setRates(Employee hr, Map<String, BigDecimal> perUsd) {
        rates.findAll().forEach(rate -> rate.change(perUsd.get(rate.getCurrency()), hr.getId(), today()));
        return rates();
    }

    private BigDecimal toUsd(BigDecimal amount, String currency) {
        if (USD.equals(currency)) {
            return amount.setScale(CENTS, RoundingMode.HALF_UP);
        }
        BigDecimal rate = rates.findById(currency).map(ExchangeRate::getPerUsd)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Pick USD, MVR or INR."));
        return amount.divide(rate, CENTS, RoundingMode.HALF_UP);
    }

    private BigDecimal total(String employeeId, int year) {
        return claims.usdIn(employeeId, APPROVED, LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
    }

    private FlightClaim own(Employee employee, String id) {
        return claims.findById(id).filter(claim -> claim.getEmployeeId().equals(employee.getId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Claim not found"));
    }

    private static UUID receipt(FlightClaim claim) {
        if (claim.getReceiptFileId() == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "No receipt on this claim.");
        }
        return claim.getReceiptFileId();
    }

    // "$1,250.00"
    private static String dollars(BigDecimal usd) {
        return NumberFormat.getCurrencyInstance(Locale.US).format(usd);
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}
