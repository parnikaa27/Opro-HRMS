package mv.opro.hrms.leave;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;
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

    // entitled includes anything carried forward from last year, which carriedOver shows on its own.
    public record Balance(String type, BigDecimal entitled, BigDecimal taken, BigDecimal pending, BigDecimal carriedOver) {}

    public record Application(String type, LocalDate from, LocalDate to, String halfDay, String reason) {}

    public record Decision(String decision, String note) {}

    // How far back carry forward is followed. Older years can't change what's carried by now.
    private static final int CARRY_YEARS_BACK = 5;
    private static final int MAX_CODE_LENGTH = 20;

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

    // This leave year's balances, in the policy's order. Unlimited, retired and removed types have none.
    @Transactional
    public List<Balance> balancesOf(String employeeId) {
        int year = today().getYear();
        openYear(employeeId, year);
        Map<String, LeaveEntitlement> byType = entitlements.findByEmployeeIdAndLeaveYear(employeeId, year).stream()
                .filter(entitlement -> !entitlement.isRemoved())
                .collect(Collectors.toMap(LeaveEntitlement::getType, Function.identity()));
        return types().stream()
                .filter(type -> !type.isRetired() && byType.containsKey(type.getCode()))
                .map(type -> balance(employeeId, type, byType.get(type.getCode()), year))
                .toList();
    }

    // Super admins need nobody's approval, so theirs is approved as it's saved.
    @Transactional
    public LeaveRequest apply(Employee employee, Application application) {
        Checked checked = check(employee, application);
        LeaveRequest request = LeaveRequest.apply(Ids.next("LR"), employee.getId(), checked.type().getCode(), application.from(), application.to(),
                application.halfDay(), checked.days(), application.reason().strip(), today());
        if (employee.isSuperAdmin()) {
            request.decide(LeaveRequest.APPROVED, employee.getId(), today(), null);
        } else if (employee.getManagerId() != null) {
            notifications.tell(employee.getManagerId(), Notification.Kind.APPROVAL, employee.getFullName() + " asked for " + Wording.days(checked.days())
                    + " of " + checked.type().getName().toLowerCase() + " " + Wording.when(application.from(), application.to()));
        }
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
        LeaveType type = bookableType(typeCode);
        int year = today().getYear();
        LeaveEntitlement entitlement = heldOrOpened(employeeId, type, year);
        Balance before = balance(employeeId, type, entitlement, year);
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
    public LeaveType updateType(String code, LeaveType.Rules rules) {
        LeaveType type = types.findById(code).filter(found -> !found.isRetired())
                .orElseThrow(() -> refused(HttpStatus.NOT_FOUND, "Leave type not found"));
        checkName(rules.name(), code);
        type.update(checked(rules));
        return type;
    }

    // A type for everyone opens for everyone the next time their balances load, this year included.
    @Transactional
    public LeaveType addType(LeaveType.Rules rules) {
        String code = codeFor(rules.name());
        if (types.existsById(code)) {
            throw refused(HttpStatus.CONFLICT, "There's already a leave type called that.");
        }
        checkName(rules.name(), code);
        int sortOrder = types().stream().filter(type -> !LeaveType.COMP_OFF.equals(type.getCode())).mapToInt(LeaveType::getSortOrder).max().orElse(0) + 1;
        return types.save(LeaveType.create(code, sortOrder, checked(rules)));
    }

    // Never used, it's deleted. Used, it's retired: no new requests, history kept.
    @Transactional
    public void removeType(String code) {
        LeaveType type = types.findById(code).filter(found -> !found.isRetired())
                .orElseThrow(() -> refused(HttpStatus.NOT_FOUND, "Leave type not found"));
        if (LeaveType.COMP_OFF.equals(code)) {
            throw refused(HttpStatus.CONFLICT, "Compensatory off pays back Fridays and holidays worked, so it stays.");
        }
        if (entitlements.existsByType(code) || requests.existsByType(code)) {
            type.retire(today());
        } else {
            types.delete(type);
        }
    }

    // HR sets how many days one person gets of a type this year: less for someone who joined late, or a type
    // only they get. Logged like any adjustment. Giving back a removed type restores it.
    @Transactional
    public void setDays(Employee hr, String employeeId, String typeCode, BigDecimal days, String reason) {
        employees.lockById(employeeId);
        LeaveType type = bookableType(typeCode);
        int year = today().getYear();
        LeaveEntitlement entitlement = entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), year)
                .orElseGet(() -> entitlements.save(LeaveEntitlement.fresh(employeeId, type.getCode(), year, BigDecimal.ZERO)));
        boolean wasRemoved = entitlement.isRemoved();
        BigDecimal change = days.subtract(entitlement.getEntitled());
        if (change.signum() == 0 && !wasRemoved) {
            throw refused(HttpStatus.BAD_REQUEST, "They already get " + plural(days) + " of " + type.getName().toLowerCase() + ".");
        }
        Balance balance = balance(employeeId, type, entitlement, year);
        BigDecimal used = balance.taken().add(balance.pending());
        if (days.add(balance.carriedOver()).compareTo(used) < 0) {
            throw refused(HttpStatus.CONFLICT, "They've already taken or booked " + plural(used) + ", so it can't go below that.");
        }
        entitlement.restore();
        entitlement.adjust(change);
        if (change.signum() != 0) {
            adjustments.save(new BalanceAdjustment(Ids.next("BA"), employeeId, type.getCode(), year, change, reason.strip(), hr.getId(), today()));
        }
        notifications.tell(employeeId, Notification.Kind.LEAVE, "HR set your " + type.getName().toLowerCase() + " to " + plural(days) + " this year. "
                + Wording.sentence(reason));
    }

    // Takes a type away from one person. What they've taken stays on record. Waiting requests must be decided first.
    @Transactional
    public void removeFrom(String employeeId, String typeCode, String reason) {
        employees.lockById(employeeId);
        int year = today().getYear();
        LeaveType type = types.findById(typeCode).orElseThrow(() -> refused(HttpStatus.NOT_FOUND, "Leave type not found"));
        LeaveEntitlement entitlement = entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, typeCode, year)
                .filter(found -> !found.isRemoved())
                .orElseThrow(() -> refused(HttpStatus.NOT_FOUND, "They don't have " + type.getName().toLowerCase() + "."));
        if (requests.daysIn(employeeId, typeCode, LeaveRequest.PENDING, LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31)).signum() > 0) {
            throw refused(HttpStatus.CONFLICT, "Decide their waiting " + type.getName().toLowerCase() + " request first.");
        }
        entitlement.remove(today());
        notifications.tell(employeeId, Notification.Kind.LEAVE, "HR removed " + type.getName().toLowerCase() + " from your leave. " + Wording.sentence(reason));
    }

    // Approved compensatory off goes into the year the day was worked, logged with who approved it.
    @Transactional
    public void earnCompOff(Employee approver, String employeeId, LocalDate worked, BigDecimal days) {
        int year = worked.getYear();
        entitlements.open(employeeId, LeaveType.COMP_OFF, year, BigDecimal.ZERO);
        LeaveEntitlement entitlement = entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, LeaveType.COMP_OFF, year).orElseThrow();
        entitlement.restore();
        entitlement.adjust(days);
        adjustments.save(new BalanceAdjustment(Ids.next("BA"), employeeId, LeaveType.COMP_OFF, year, days,
                "Worked on " + Wording.date(worked), approver.getId(), today()));
    }

    // A new starter gets this year's leave in full. Types given one by one, like maternity, are added by HR.
    @Transactional
    public void openYearFor(String employeeId) {
        openYear(employeeId, today().getYear());
    }

    // Everyone holds every type that's for everyone, from the policy's default. Runs whenever balances are read,
    // so a new year, or a new type, opens without anyone having to do it.
    private void openYear(String employeeId, int year) {
        types().stream()
                .filter(type -> type.isForEveryone() && !type.isRetired() && !type.isUnlimited() && type.getDefaultEntitlement() != null)
                .forEach(type -> entitlements.open(employeeId, type.getCode(), year, type.getDefaultEntitlement()));
    }

    // Leave after someone's last day can't be taken, so it goes when they do.
    @Transactional
    public void cancelAfter(String employeeId, LocalDate lastDay) {
        requests.openAfter(employeeId, lastDay).forEach(LeaveRequest::cancel);
    }

    private record Checked(LeaveType type, BigDecimal days) {}

    // Every rule a request has to pass, worded for the person applying or for HR recording it for them.
    private Checked check(Employee employee, Application application) {
        // One change at a time per person, so two requests sent at once can't both spend the same days.
        employees.lockById(employee.getId());
        LeaveType type = types.findById(application.type()).orElseThrow(() -> refused(HttpStatus.BAD_REQUEST, "Pick a type of leave."));
        if (type.isRetired()) {
            throw refused(HttpStatus.BAD_REQUEST, type.getName() + " isn't offered any more.");
        }
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
            throw refused(HttpStatus.BAD_REQUEST, "Those dates are all Fridays or public holidays. Nothing to take.");
        }
        if (requests.overlaps(employee.getId(), from, to)) {
            throw refused(HttpStatus.CONFLICT, "You already have leave on some of those days.");
        }
        if (!type.isUnlimited()) {
            openYear(employee.getId(), today().getYear());
            Balance balance = balance(employee.getId(), type, entitlementFor(employee.getId(), type, from.getYear()), from.getYear());
            BigDecimal available = balance.entitled().subtract(balance.taken()).subtract(balance.pending());
            if (days.compareTo(available) > 0) {
                String left = plural(available) + " of " + type.getName().toLowerCase() + " left.";
                throw refused(HttpStatus.CONFLICT, "You only have " + left);
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
    // as long as they hold that type this year.
    private LeaveEntitlement entitlementFor(String employeeId, LeaveType type, int year) {
        Supplier<ApiException> none = () -> refused(HttpStatus.BAD_REQUEST, "You don't have " + type.getName().toLowerCase() + " to take.");
        LeaveEntitlement held = entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), year).orElseGet(() -> {
            boolean holdsItNow = entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), today().getYear())
                    .filter(entitlement -> !entitlement.isRemoved()).isPresent();
            if (year <= today().getYear() || !holdsItNow || type.getDefaultEntitlement() == null) {
                throw none.get();
            }
            return entitlements.save(LeaveEntitlement.fresh(employeeId, type.getCode(), year, type.getDefaultEntitlement()));
        });
        if (held.isRemoved()) {
            throw none.get();
        }
        return held;
    }

    // A type with a balance that isn't retired. HR adjusts and sets days on these.
    private LeaveType bookableType(String code) {
        return types.findById(code).filter(type -> !type.isUnlimited() && !type.isRetired())
                .orElseThrow(() -> refused(HttpStatus.BAD_REQUEST, "Pick a type of leave that has a balance."));
    }

    // Adjusting a type they don't hold yet, like paternity leave, opens it. One HR took away comes back.
    private LeaveEntitlement heldOrOpened(String employeeId, LeaveType type, int year) {
        LeaveEntitlement entitlement = entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), year)
                .orElseGet(() -> entitlements.save(LeaveEntitlement.fresh(employeeId, type.getCode(), year, BigDecimal.ZERO)));
        entitlement.restore();
        return entitlement;
    }

    private Balance balance(String employeeId, LeaveType type, LeaveEntitlement entitlement, int year) {
        BigDecimal carried = carriedInto(employeeId, type, year, CARRY_YEARS_BACK);
        BigDecimal pending = requests.daysIn(employeeId, type.getCode(), LeaveRequest.PENDING, LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
        return new Balance(type.getCode(), entitlement.getEntitled().add(carried), taken(employeeId, entitlement, year), pending, carried);
    }

    private BigDecimal taken(String employeeId, LeaveEntitlement entitlement, int year) {
        return entitlement.getTakenBefore()
                .add(requests.daysIn(employeeId, entitlement.getType(), LeaveRequest.APPROVED, LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31)));
    }

    // What's left of last year, up to the type's cap. Worked out every time, so a late change to last year still counts.
    private BigDecimal carriedInto(String employeeId, LeaveType type, int year, int yearsBack) {
        if (!type.carriesForward() || yearsBack == 0) {
            return BigDecimal.ZERO;
        }
        return entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), year - 1)
                .filter(previous -> !previous.isRemoved())
                .map(previous -> previous.getEntitled().add(carriedInto(employeeId, type, year - 1, yearsBack - 1)).subtract(taken(employeeId, previous, year - 1)))
                .map(left -> left.max(BigDecimal.ZERO).min(type.getCarryForwardCap()))
                .orElse(BigDecimal.ZERO);
    }

    // A rule set the database would refuse, refused first with a reason.
    private static LeaveType.Rules checked(LeaveType.Rules rules) {
        if (!rules.isUnlimited() && rules.defaultEntitlement() == null) {
            throw refused(HttpStatus.BAD_REQUEST, "Say how many days a year it gives.");
        }
        if (rules.carriesForward() && rules.carryForwardCap() == null) {
            throw refused(HttpStatus.BAD_REQUEST, "Say how many days can carry forward.");
        }
        return new LeaveType.Rules(rules.name().strip(), rules.allowsHalfDay(), rules.isUnlimited(), rules.defaultEntitlement(),
                rules.documentRequiredAfterDays(), rules.isForEveryone(), rules.carriesForward(), rules.carryForwardCap());
    }

    private void checkName(String name, String code) {
        boolean isTaken = types().stream().anyMatch(type -> !type.isRetired() && !type.getCode().equals(code) && type.getName().equalsIgnoreCase(name.strip()));
        if (isTaken) {
            throw refused(HttpStatus.CONFLICT, "There's already a leave type called that.");
        }
    }

    // "Marriage leave" becomes "marriage-leave".
    private static String codeFor(String name) {
        String code = Normalizer.normalize(name.strip().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
        String trimmed = code.length() > MAX_CODE_LENGTH ? code.substring(0, MAX_CODE_LENGTH).replaceAll("-$", "") : code;
        if (trimmed.isEmpty()) {
            throw refused(HttpStatus.BAD_REQUEST, "Give the leave type a name with letters or numbers.");
        }
        return trimmed;
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
