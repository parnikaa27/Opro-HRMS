package mv.opro.hrms.leave;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.files.Files;
import mv.opro.hrms.files.Upload;
import mv.opro.hrms.holiday.Holidays;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Leave balances and requests. The backend owns the day count and the balance: the frontend's numbers are a preview.
@Service
@Transactional(readOnly = true)
public class LeaveService {

    public record Balance(String type, BigDecimal entitled, BigDecimal taken, BigDecimal pending) {}

    public record Application(String type, LocalDate from, LocalDate to, String halfDay, String reason) {}

    public record Decision(String decision, String note) {}

    // Leave tied to an event rather than a year. Granted by an adjustment when it applies.
    private static final Set<String> EVENT_TYPES = Set.of("maternity", "paternity");

    private final LeaveTypeRepository types;
    private final LeaveEntitlementRepository entitlements;
    private final LeaveRequestRepository requests;
    private final BalanceAdjustmentRepository adjustments;
    private final EmployeeRepository employees;
    private final Holidays holidays;
    private final Notifications notifications;
    private final Files files;
    private final Clock clock;

    LeaveService(LeaveTypeRepository types, LeaveEntitlementRepository entitlements, LeaveRequestRepository requests,
            BalanceAdjustmentRepository adjustments, EmployeeRepository employees, Holidays holidays, Notifications notifications, Files files,
            Clock clock) {
        this.types = types;
        this.entitlements = entitlements;
        this.requests = requests;
        this.adjustments = adjustments;
        this.employees = employees;
        this.holidays = holidays;
        this.notifications = notifications;
        this.files = files;
        this.clock = clock;
    }

    public List<LeaveType> types() {
        return types.findAllByOrderBySortOrder();
    }

    public List<LeaveRequest> requestsOf(String employeeId) {
        return requests.findByEmployeeIdOrderByFromDateDesc(employeeId);
    }

    // A manager's reports, or later everyone for HR. No status means all of them.
    public List<LeaveRequest> requestsOf(Collection<String> employeeIds, String status) {
        return status == null
                ? requests.findByEmployeeIdInOrderByFromDateDesc(employeeIds)
                : requests.findByEmployeeIdInAndStatusOrderByFromDateDesc(employeeIds, status);
    }

    // Decide a pending request for someone in scope. Declining needs a reason, so they can plan around it.
    @Transactional
    public LeaveRequest decide(Employee decider, String id, Collection<String> inScope, Decision decision) {
        LeaveRequest request = requests.findById(id)
                .filter(found -> inScope.contains(found.getEmployeeId()))
                .orElseThrow(() -> refused(HttpStatus.NOT_FOUND, "Request not found"));
        if (!request.isPending()) {
            throw refused(HttpStatus.CONFLICT, "This request has already been decided.");
        }
        String note = decision.note() == null || decision.note().isBlank() ? null : decision.note().strip();
        boolean isApproved = LeaveRequest.APPROVED.equals(decision.decision());
        if (!isApproved && note == null) {
            throw refused(HttpStatus.BAD_REQUEST, "Give a short reason so they know what to do next.");
        }
        request.decide(decision.decision(), decider.getId(), today(), note);
        String what = "Your " + typeName(request.getType()) + " for " + Wording.dates(request.getFromDate(), request.getToDate());
        notifications.tell(request.getEmployeeId(), Notification.Kind.LEAVE,
                isApproved ? what + " was approved." : what + " was declined: " + Wording.sentence(note));
        return request;
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
        Checked checked = check(employee, application, true);
        LeaveRequest request = LeaveRequest.apply(Ids.next("LR"), employee.getId(), checked.type().getCode(), application.from(), application.to(),
                application.halfDay(), checked.days(), application.reason().strip(), today());
        if (employee.getManagerId() != null) {
            notifications.tell(employee.getManagerId(), Notification.Kind.APPROVAL, employee.getFullName() + " asked for " + Wording.days(checked.days())
                    + " of " + checked.type().getName().toLowerCase() + " " + Wording.when(application.from(), application.to()));
        }
        return requests.save(request);
    }

    // HR recording leave for someone who can't apply themselves. Same rules as applying, saved as approved.
    @Transactional
    public LeaveRequest recordFor(Employee hr, Employee employee, Application application) {
        Checked checked = check(employee, application, false);
        LeaveRequest request = LeaveRequest.recordedByHr(Ids.next("LR"), employee.getId(), checked.type().getCode(), application.from(),
                application.to(), application.halfDay(), checked.days(), application.reason().strip(), hr.getId(), today());
        notifications.tell(employee.getId(), Notification.Kind.LEAVE, "HR recorded " + Wording.days(checked.days()) + " of "
                + checked.type().getName().toLowerCase() + " for you, " + Wording.dates(application.from(), application.to()) + ". "
                + Wording.sentence(application.reason()));
        return requests.save(request);
    }

    // Everyone's requests, for HR. No status means all of them.
    public List<LeaveRequest> allRequests(String status) {
        return status == null ? requests.findAllByOrderByFromDateDesc() : requests.findByStatusOrderByFromDateDesc(status);
    }

    // A manual change to this year's balance. The reason is required and kept in the log for good.
    @Transactional
    public BalanceAdjustment adjust(Employee hr, String employeeId, String typeCode, BigDecimal days, String reason) {
        employees.lockById(employeeId);
        LeaveType type = types.findById(typeCode).filter(found -> !found.isUnlimited())
                .orElseThrow(() -> refused(HttpStatus.BAD_REQUEST, "Pick a type of leave that has a balance."));
        int year = today().getYear();
        // Adjusting a type they don't hold yet, like paternity leave, opens it.
        LeaveEntitlement entitlement = entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), year)
                .orElseGet(() -> entitlements.save(LeaveEntitlement.fresh(employeeId, type.getCode(), year, BigDecimal.ZERO)));
        Balance before = balance(employeeId, entitlement, year);
        if (before.entitled().add(days).compareTo(before.taken().add(before.pending())) < 0) {
            throw refused(HttpStatus.CONFLICT, "That would leave less than they've already taken or booked.");
        }
        entitlement.adjust(days);
        BalanceAdjustment adjustment = adjustments.save(new BalanceAdjustment(Ids.next("BA"), employeeId, type.getCode(), year, days, reason.strip(),
                hr.getId(), today()));
        String change = days.signum() > 0 ? "added " + Wording.days(days) + " to" : "removed " + Wording.days(days.negate()) + " from";
        notifications.tell(employeeId, Notification.Kind.LEAVE, "HR " + change + " your " + type.getName().toLowerCase() + ". " + Wording.sentence(reason));
        return adjustment;
    }

    public List<BalanceAdjustment> adjustmentsOf(String employeeId) {
        return adjustments.findByEmployeeIdOrderByMadeOnDescIdDesc(employeeId);
    }

    // A policy change applies from the next leave year. Balances already given out stay as they are.
    @Transactional
    public LeaveType updateType(String code, String name, boolean allowsHalfDay, BigDecimal defaultEntitlement) {
        LeaveType type = types.findById(code).orElseThrow(() -> refused(HttpStatus.NOT_FOUND, "Leave type not found"));
        type.update(name.strip(), allowsHalfDay, defaultEntitlement);
        return type;
    }

    // A new starter gets this year's leave in full. Maternity and paternity are opened when they apply.
    @Transactional
    public void openYearFor(String employeeId) {
        int year = today().getYear();
        types().stream()
                .filter(type -> !type.isUnlimited() && type.getDefaultEntitlement() != null && !EVENT_TYPES.contains(type.getCode()))
                .forEach(type -> entitlements.save(LeaveEntitlement.fresh(employeeId, type.getCode(), year, type.getDefaultEntitlement())));
    }

    // Leave after someone's last day can't be taken, so it goes when they do.
    @Transactional
    public void cancelAfter(String employeeId, LocalDate lastDay) {
        requests.openAfter(employeeId, lastDay).forEach(LeaveRequest::cancel);
    }

    private record Checked(LeaveType type, BigDecimal days) {}

    // Every rule a request has to pass, worded for the person applying or for HR recording it for them.
    private Checked check(Employee employee, Application application, boolean isOwn) {
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
            throw refused(HttpStatus.CONFLICT, (isOwn ? "You already have" : "They already have") + " leave on some of those days.");
        }
        if (!type.isUnlimited()) {
            Balance balance = balance(employee.getId(), entitlementFor(employee.getId(), type, from.getYear(), isOwn), from.getYear());
            BigDecimal available = balance.entitled().subtract(balance.taken()).subtract(balance.pending());
            if (days.compareTo(available) > 0) {
                String left = plural(available) + " of " + type.getName().toLowerCase() + " left.";
                throw refused(HttpStatus.CONFLICT, isOwn ? "You only have " + left : "They only have " + left + " Adjust their balance first if they're owed more.");
            }
        }
        return new Checked(type, days);
    }

    // A medical certificate on one's own sick leave. A new one replaces the old.
    @Transactional
    public LeaveRequest attachCertificate(Employee employee, String id, Upload upload) {
        LeaveRequest request = ownRequest(employee, id);
        if (!request.acceptsCertificate()) {
            throw refused(HttpStatus.CONFLICT, "Certificates go on sick leave that's waiting or approved.");
        }
        UUID previous = request.attachCertificate(files.store(upload, employee.getId()));
        if (previous != null) {
            files.delete(previous);
        }
        return request;
    }

    // HR can open any certificate. Managers never reach this.
    public UUID certificateOfAnyone(String id) {
        UUID fileId = requests.findById(id).map(LeaveRequest::getCertificateFileId).orElse(null);
        if (fileId == null) {
            throw refused(HttpStatus.NOT_FOUND, "No certificate on this request.");
        }
        return fileId;
    }

    public UUID certificateOf(Employee employee, String id) {
        UUID fileId = ownRequest(employee, id).getCertificateFileId();
        if (fileId == null) {
            throw refused(HttpStatus.NOT_FOUND, "No certificate on this request.");
        }
        return fileId;
    }

    private LeaveRequest ownRequest(Employee employee, String id) {
        return requests.findById(id)
                .filter(found -> found.getEmployeeId().equals(employee.getId()))
                .orElseThrow(() -> refused(HttpStatus.NOT_FOUND, "Request not found"));
    }

    @Transactional
    public LeaveRequest cancel(Employee employee, String id) {
        LeaveRequest request = ownRequest(employee, id);
        if (!request.canBeCancelledOn(today())) {
            throw refused(HttpStatus.CONFLICT, "This leave has started or been decided, so it can't be cancelled any more.");
        }
        request.cancel();
        return request;
    }

    // The year's entitlement. Next year's is opened from the policy the first time someone books into it,
    // as long as they hold that type this year. Carry forward is none until HR says otherwise.
    private LeaveEntitlement entitlementFor(String employeeId, LeaveType type, int year, boolean isOwn) {
        return entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), year).orElseGet(() -> {
            boolean holdsItNow = entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), today().getYear()).isPresent();
            if (year <= today().getYear() || !holdsItNow || type.getDefaultEntitlement() == null) {
                throw refused(HttpStatus.BAD_REQUEST, (isOwn ? "You don't" : "They don't") + " have " + type.getName().toLowerCase() + " to take.");
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

    private String typeName(String code) {
        return types.findById(code).map(type -> type.getName().toLowerCase()).orElse(code);
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
