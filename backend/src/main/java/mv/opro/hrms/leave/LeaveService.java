package mv.opro.hrms.leave;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.holiday.Holidays;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Leave balances and requests. The backend owns the day count and the balance: the frontend's numbers are a preview.
@Service
@Transactional(readOnly = true)
public class LeaveService {

    public record Balance(String type, BigDecimal entitled, BigDecimal taken, BigDecimal pending) {}

    public record Application(String type, LocalDate from, LocalDate to, String halfDay, String reason) {}

    private final LeaveTypeRepository types;
    private final LeaveEntitlementRepository entitlements;
    private final LeaveRequestRepository requests;
    private final EmployeeRepository employees;
    private final Holidays holidays;
    private final Clock clock;

    LeaveService(LeaveTypeRepository types, LeaveEntitlementRepository entitlements, LeaveRequestRepository requests, EmployeeRepository employees,
            Holidays holidays, Clock clock) {
        this.types = types;
        this.entitlements = entitlements;
        this.requests = requests;
        this.employees = employees;
        this.holidays = holidays;
        this.clock = clock;
    }

    public List<LeaveType> types() {
        return types.findAllByOrderBySortOrder();
    }

    public List<LeaveRequest> requestsOf(String employeeId) {
        return requests.findByEmployeeIdOrderByFromDateDesc(employeeId);
    }

    // This leave year's balances, in the policy's order. Unlimited types have none.
    public List<Balance> balancesOf(String employeeId) {
        int year = today().getYear();
        Map<String, LeaveEntitlement> byType = entitlements.findByEmployeeIdAndLeaveYear(employeeId, year).stream()
                .collect(Collectors.toMap(LeaveEntitlement::getType, Function.identity()));
        return types().stream()
                .filter(type -> byType.containsKey(type.getCode()))
                .map(type -> balance(employeeId, byType.get(type.getCode()), year))
                .toList();
    }

    @Transactional
    public LeaveRequest apply(Employee employee, Application application) {
        // One change at a time per person, so two requests sent at once can't both spend the same days.
        employees.lockById(employee.getId());
        LeaveType type = types.findById(application.type()).orElseThrow(() -> refused(HttpStatus.BAD_REQUEST, "Pick a type of leave."));
        LocalDate from = application.from();
        LocalDate to = application.to();
        if (to.isBefore(from)) {
            throw refused(HttpStatus.BAD_REQUEST, "The last day can't be before the first.");
        }
        if (from.getYear() != to.getYear()) {
            throw refused(HttpStatus.BAD_REQUEST, "Leave can't run past New Year. Split it into two requests, one for each year.");
        }
        boolean isHalfDay = application.halfDay() != null;
        if (isHalfDay && !from.equals(to)) {
            throw refused(HttpStatus.BAD_REQUEST, "A half day has to be a single day.");
        }
        if (isHalfDay && !type.allowsHalfDay()) {
            throw refused(HttpStatus.BAD_REQUEST, type.getName() + " can't be taken as a half day.");
        }
        BigDecimal days = WorkingDays.count(from, to, isHalfDay, holidays.datesBetween(from, to));
        if (days.signum() == 0) {
            throw refused(HttpStatus.BAD_REQUEST, "Those dates are all weekends or holidays. Nothing to take.");
        }
        if (requests.overlaps(employee.getId(), from, to)) {
            throw refused(HttpStatus.CONFLICT, "You already have leave on some of those days.");
        }
        if (!type.isUnlimited()) {
            Balance balance = balance(employee.getId(), entitlementFor(employee.getId(), type, from.getYear()), from.getYear());
            BigDecimal available = balance.entitled().subtract(balance.taken()).subtract(balance.pending());
            if (days.compareTo(available) > 0) {
                throw refused(HttpStatus.CONFLICT, "You only have " + plural(available) + " of " + type.getName().toLowerCase() + " left.");
            }
        }
        LeaveRequest request = LeaveRequest.apply(Ids.next("LR"), employee.getId(), type.getCode(), from, to, application.halfDay(), days,
                application.reason().strip(), today());
        return requests.save(request);
    }

    @Transactional
    public LeaveRequest cancel(Employee employee, String id) {
        LeaveRequest request = requests.findById(id)
                .filter(found -> found.getEmployeeId().equals(employee.getId()))
                .orElseThrow(() -> refused(HttpStatus.NOT_FOUND, "Request not found"));
        if (!request.canBeCancelledOn(today())) {
            throw refused(HttpStatus.CONFLICT, "This leave has started or been decided, so it can't be cancelled any more.");
        }
        request.cancel();
        return request;
    }

    // The year's entitlement. Next year's is opened from the policy the first time someone books into it,
    // as long as they hold that type this year. Carry forward is none until HR says otherwise.
    private LeaveEntitlement entitlementFor(String employeeId, LeaveType type, int year) {
        return entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), year).orElseGet(() -> {
            boolean holdsItNow = entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), today().getYear()).isPresent();
            if (year <= today().getYear() || !holdsItNow || type.getDefaultEntitlement() == null) {
                throw refused(HttpStatus.BAD_REQUEST, "You don't have " + type.getName().toLowerCase() + " to take.");
            }
            return entitlements.save(LeaveEntitlement.fresh(employeeId, type.getCode(), year, type.getDefaultEntitlement()));
        });
    }

    private Balance balance(String employeeId, LeaveEntitlement entitlement, int year) {
        LocalDate start = LocalDate.of(year, 1, 1);
        LocalDate end = LocalDate.of(year, 12, 31);
        BigDecimal approved = requests.daysIn(employeeId, entitlement.getType(), LeaveRequest.APPROVED, start, end);
        BigDecimal pending = requests.daysIn(employeeId, entitlement.getType(), LeaveRequest.PENDING, start, end);
        return new Balance(entitlement.getType(), entitlement.getEntitled(), entitlement.getTakenBefore().add(approved), pending);
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private static String plural(BigDecimal days) {
        String number = days.stripTrailingZeros().toPlainString();
        return number + (days.compareTo(BigDecimal.ONE) == 0 ? " day" : " days");
    }

    private static ApiException refused(HttpStatus status, String message) {
        return new ApiException(status, message);
    }
}
