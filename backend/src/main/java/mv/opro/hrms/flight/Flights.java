package mv.opro.hrms.flight;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.Wording;
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
    private static final String PENDING = "pending";
    private static final int CENTS = 2;

    // One person's year: what they get, what's approved, what's waiting, and every claim.
    public record Year(int year, BigDecimal allowanceUsd, BigDecimal usedUsd, BigDecimal pendingUsd, List<FlightClaim> claims) {}

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
        return new Year(year, allowance, total(employeeId, APPROVED, year), total(employeeId, PENDING, year),
                claims.findByEmployeeIdOrderByFlightDateDescIdDesc(employeeId));
    }

    public List<FlightClaim> all(String status) {
        return status == null ? claims.findAllByOrderByRaisedOnDescIdDesc() : claims.findByStatusOrderByRaisedOnDescIdDesc(status);
    }

    // A claim counts against the year of the flight. It can't go past what's left once waiting claims are counted.
    @Transactional
    public FlightClaim claim(Employee employee, NewClaim claim) {
        employees.lockById(employee.getId());
        int year = claim.flightDate().getYear();
        BigDecimal allowance = allowances.findById(new FlightAllowance.Key(employee.getId(), year)).map(FlightAllowance::getAmountUsd)
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "You don't have a flight allowance for " + year + ". Ask HR about it."));
        BigDecimal usd = toUsd(claim.amount(), claim.currency());
        BigDecimal left = allowance.subtract(total(employee.getId(), APPROVED, year)).subtract(total(employee.getId(), PENDING, year));
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
        if (!claim.isPending()) {
            throw new ApiException(HttpStatus.CONFLICT, "Receipts go on claims that are still waiting.");
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
        if (!claim.isPending()) {
            throw new ApiException(HttpStatus.CONFLICT, "Only a claim that's still waiting can be cancelled.");
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

    // HR decides. Approving checks the allowance again, in case it was lowered since. Declining needs a reason.
    @Transactional
    public FlightClaim decide(Employee hr, String id, Collection<String> inScope, String decision, String note) {
        FlightClaim claim = claims.findById(id).filter(found -> inScope.contains(found.getEmployeeId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Claim not found"));
        if (!claim.isPending()) {
            throw new ApiException(HttpStatus.CONFLICT, "This claim has already been decided.");
        }
        String cleanNote = note == null || note.isBlank() ? null : note.strip();
        boolean isApproved = APPROVED.equals(decision);
        if (!isApproved && cleanNote == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Give a short reason so they know what to do next.");
        }
        int year = claim.getFlightDate().getYear();
        if (isApproved) {
            BigDecimal allowance = allowances.findById(new FlightAllowance.Key(claim.getEmployeeId(), year)).map(FlightAllowance::getAmountUsd)
                    .orElse(BigDecimal.ZERO);
            if (total(claim.getEmployeeId(), APPROVED, year).add(claim.getAmountUsd()).compareTo(allowance) > 0) {
                throw new ApiException(HttpStatus.CONFLICT, "Approving it would go over their allowance. Raise their allowance first.");
            }
        }
        claim.decide(decision, hr.getId(), today(), cleanNote);
        String what = "Your flight claim for " + claim.getRoute() + " (" + dollars(claim.getAmountUsd()) + ")";
        notifications.tell(claim.getEmployeeId(), Notification.Kind.FLIGHT,
                isApproved ? what + " was approved." : what + " was declined: " + Wording.sentence(cleanNote));
        return claim;
    }

    // Never below what's already approved or waiting for that year.
    @Transactional
    public void setAllowance(Employee hr, String employeeId, int year, BigDecimal amountUsd) {
        employees.lockById(employeeId);
        BigDecimal claimed = total(employeeId, APPROVED, year).add(total(employeeId, PENDING, year));
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

    private BigDecimal total(String employeeId, String status, int year) {
        return claims.usdIn(employeeId, status, LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
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
