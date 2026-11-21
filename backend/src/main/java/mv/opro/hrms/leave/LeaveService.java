package mv.opro.hrms.leave;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import mv.opro.hrms.approval.ApprovalSteps;
import mv.opro.hrms.attendance.CompOffGrants;
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

    // entitled includes anything carried forward from last year, which carriedOver shows on its own. taken counts approved
    // days in the leave year, takenToDate only those up to today. expiresOn is when the soonest compensatory off runs out.
    public record Balance(String type, BigDecimal entitled, BigDecimal taken, BigDecimal pending, BigDecimal carriedOver, BigDecimal takenToDate,
            LocalDate expiresOn) {}

    // kind is initial, amended or extended. The last two name the request they change in relatedId.
    public record Application(String type, LocalDate from, LocalDate to, String halfDay, String reason, String kind, String relatedId,
            boolean usesFlightEntitlement, boolean wantsSalaryAdvance) {}

    public record Decision(String decision, String note) {}

    // How far back carry forward is followed. Older years can't change what's carried by now.
    private static final int CARRY_YEARS_BACK = 5;
    private static final int MAX_CODE_LENGTH = 20;
    private static final List<String> OPEN = List.of(LeaveRequest.PENDING, LeaveRequest.APPROVED);

    private final LeaveTypeRepository types;
    private final LeaveEntitlementRepository entitlements;
    private final LeaveRequestRepository requests;
    private final BalanceAdjustmentRepository adjustments;
    private final EmployeeRepository employees;
    private final Holidays holidays;
    private final Notifications notifications;
    private final Files files;
    private final ApprovalSteps steps;
    private final CompOffGrants compOffGrants;
    private final Clock clock;

    LeaveService(LeaveTypeRepository types, LeaveEntitlementRepository entitlements, LeaveRequestRepository requests,
            BalanceAdjustmentRepository adjustments, EmployeeRepository employees, Holidays holidays, Notifications notifications, Files files,
            ApprovalSteps steps, CompOffGrants compOffGrants, Clock clock) {
        this.types = types;
        this.entitlements = entitlements;
        this.requests = requests;
        this.adjustments = adjustments;
        this.employees = employees;
        this.holidays = holidays;
        this.notifications = notifications;
        this.files = files;
        this.steps = steps;
        this.compOffGrants = compOffGrants;
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
        steps.checkHodStep(request.isWaitingForHr());
        boolean needsHr = types.findById(request.getType()).map(LeaveType::needsHrApproval).orElse(false);
        if (LeaveRequest.APPROVED.equals(decision.decision()) && steps.passesToHr(decider, needsHr)) {
            request.approveForHod(decider.getId(), today());
            steps.passToHr(decider, request.getEmployeeId(), Notification.Kind.LEAVE, typeName(request.getType()) + " for "
                    + Wording.dates(request.getFromDate(), request.getToDate()));
            return request;
        }
        return finish(decider, request, decision);
    }

    public List<LeaveRequest> waitingForHr() {
        return requests.findByStatusAndHodApprovedByNotNullOrderByFromDate(LeaveRequest.PENDING);
    }

    // The HR step, after the HOD approved.
    @Transactional
    public LeaveRequest decideForHr(Employee hr, String id, Decision decision) {
        LeaveRequest request = requests.findById(id).orElseThrow(() -> refused(HttpStatus.NOT_FOUND, "Request not found"));
        steps.checkHrStep(hr, request.getEmployeeId(), request.isWaitingForHr());
        return finish(hr, request, decision);
    }

    private LeaveRequest finish(Employee decider, LeaveRequest request, Decision decision) {
        String note = decision.note() == null || decision.note().isBlank() ? null : decision.note().strip();
        boolean isApproved = LeaveRequest.APPROVED.equals(decision.decision());
        if (!isApproved && note == null) {
            throw refused(HttpStatus.BAD_REQUEST, "Give a short reason so they know what to do next.");
        }
        request.decide(decision.decision(), decider.getId(), today(), note);
        if (isApproved) {
            replaceAmended(request);
        }
        String what = "Your " + typeName(request.getType()) + " for " + Wording.dates(request.getFromDate(), request.getToDate());
        notifications.tell(request.getEmployeeId(), Notification.Kind.LEAVE,
                isApproved ? what + " was approved." : what + " was declined: " + Wording.sentence(note));
        return request;
    }

    // This leave year's balances, in the policy's order. Unlimited, retired and removed types have none, and
    // compensatory off shows only when there's some.
    @Transactional
    public List<Balance> balancesOf(String employeeId) {
        LeaveYear year = yearOf(employeeId, today());
        openYear(employeeId, year.number());
        Map<String, LeaveEntitlement> byType = entitlements.findByEmployeeIdAndLeaveYear(employeeId, year.number()).stream()
                .filter(entitlement -> !entitlement.isRemoved())
                .collect(Collectors.toMap(LeaveEntitlement::getType, Function.identity()));
        return types().stream()
                .filter(type -> !type.isRetired())
                .flatMap(type -> LeaveType.COMP_OFF.equals(type.getCode())
                        ? Stream.of(compOffBalance(employeeId, year)).filter(balance -> balance.entitled().signum() > 0)
                        : Optional.ofNullable(byType.get(type.getCode())).map(entitlement -> balance(employeeId, type, entitlement, year)).stream())
                .toList();
    }

    // The leave year a day falls in for someone, from their joining date.
    public LeaveYear yearOf(String employeeId, LocalDate day) {
        return LeaveYear.containing(employees.findById(employeeId).orElseThrow().getJoinedOn(), day);
    }

    // Super admins need nobody's approval, so theirs is approved as it's saved.
    @Transactional
    public LeaveRequest apply(Employee employee, Application application) {
        Checked checked = check(employee, application);
        LeaveRequest request = requests.save(LeaveRequest.apply(Ids.next("LR"), employee.getId(), application, checked.days(), today()));
        if (employee.isSuperAdmin()) {
            request.decide(LeaveRequest.APPROVED, employee.getId(), today(), null);
            replaceAmended(request);
        } else if (employee.getManagerId() != null) {
            String asked = switch (application.kind()) {
                case LeaveRequest.AMENDED -> " asked to change their leave to ";
                case LeaveRequest.EXTENDED -> " asked to extend their leave by ";
                default -> " asked for ";
            };
            notifications.tell(employee.getManagerId(), Notification.Kind.APPROVAL, employee.getFullName() + asked + Wording.days(checked.days())
                    + " of " + checked.type().getName().toLowerCase() + " " + Wording.when(application.from(), application.to()));
        }
        return request;
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
        LeaveYear year = yearOf(employeeId, today());
        LeaveEntitlement entitlement = heldOrOpened(employeeId, type, year.number());
        Balance before = balance(employeeId, type, entitlement, year);
        if (before.entitled().add(days).compareTo(before.taken().add(before.pending())) < 0) {
            throw refused(HttpStatus.CONFLICT, "That would leave less than they've already taken or booked.");
        }
        entitlement.adjust(days);
        BalanceAdjustment adjustment = adjustments.save(new BalanceAdjustment(Ids.next("BA"), employeeId, type.getCode(), year.number(), days, reason.strip(),
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
        LeaveYear year = yearOf(employeeId, today());
        LeaveEntitlement entitlement = entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), year.number())
                .orElseGet(() -> entitlements.save(LeaveEntitlement.fresh(employeeId, type.getCode(), year.number(), BigDecimal.ZERO)));
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
            adjustments.save(new BalanceAdjustment(Ids.next("BA"), employeeId, type.getCode(), year.number(), change, reason.strip(), hr.getId(), today()));
        }
        notifications.tell(employeeId, Notification.Kind.LEAVE, "HR set your " + type.getName().toLowerCase() + " to " + plural(days) + " this year. "
                + Wording.sentence(reason));
    }

    // Takes a type away from one person. What they've taken stays on record. Waiting requests must be decided first.
    @Transactional
    public void removeFrom(String employeeId, String typeCode, String reason) {
        employees.lockById(employeeId);
        LeaveYear year = yearOf(employeeId, today());
        LeaveType type = bookableType(typeCode);
        LeaveEntitlement entitlement = entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, typeCode, year.number())
                .filter(found -> !found.isRemoved())
                .orElseThrow(() -> refused(HttpStatus.NOT_FOUND, "They don't have " + type.getName().toLowerCase() + "."));
        if (requests.daysIn(employeeId, typeCode, LeaveRequest.PENDING, year.start(), year.end()).signum() > 0) {
            throw refused(HttpStatus.CONFLICT, "Decide their waiting " + type.getName().toLowerCase() + " request first.");
        }
        entitlement.remove(today());
        notifications.tell(employeeId, Notification.Kind.LEAVE, "HR removed " + type.getName().toLowerCase() + " from your leave. " + Wording.sentence(reason));
    }

    // Approved compensatory off, logged with who approved it. The days come from the approved claim itself.
    @Transactional
    public void earnCompOff(Employee approver, String employeeId, LocalDate worked, BigDecimal days) {
        adjustments.save(new BalanceAdjustment(Ids.next("BA"), employeeId, LeaveType.COMP_OFF, yearOf(employeeId, worked).number(), days,
                "Worked on " + Wording.date(worked) + ", to use by " + Wording.date(worked.plusDays(LeaveType.COMP_OFF_VALID_DAYS)), approver.getId(), today()));
    }

    // A new starter's leave year starts the day they join, with every type for everyone. Types given one by one,
    // like maternity, are added by HR.
    @Transactional
    public void openYearFor(String employeeId) {
        openYear(employeeId, yearOf(employeeId, today()).number());
    }

    // Everyone holds every type that's for everyone, from the policy's default. Runs whenever balances are read,
    // so a new year, or a new type, opens without anyone having to do it.
    private void openYear(String employeeId, int year) {
        types().stream()
                .filter(type -> type.isForEveryone() && !type.isRetired() && !type.isUnlimited() && type.getDefaultEntitlement() != null)
                .forEach(type -> entitlements.open(employeeId, type.getCode(), year, type.getDefaultEntitlement()));
    }

    // A holiday added, moved or removed changes what leave over it takes. Waiting and approved requests are counted
    // again, and anyone whose count changed is told. Leave left with no working day in it is cancelled: it isn't needed.
    @Transactional
    public void recountOver(Collection<LocalDate> dates) {
        dates.stream().distinct().flatMap(day -> requests.openOn(day).stream()).distinct().forEach(request -> {
            BigDecimal counted = WorkingDays.count(request.getFromDate(), request.getToDate(), request.getHalfDay() != null,
                    holidays.datesBetween(request.getFromDate(), request.getToDate()));
            if (counted.compareTo(request.getDays()) == 0) {
                return;
            }
            String what = "Your " + typeName(request.getType()) + " " + Wording.when(request.getFromDate(), request.getToDate());
            if (counted.signum() == 0) {
                request.cancel();
                notifications.tell(request.getEmployeeId(), Notification.Kind.LEAVE, what + " is cancelled: it's a public holiday now, so you don't need it.");
            } else {
                notifications.tell(request.getEmployeeId(), Notification.Kind.LEAVE, what + " now takes " + Wording.days(counted) + ", not "
                        + request.getDays().stripTrailingZeros().toPlainString() + ", because the public holidays changed.");
                request.recount(counted);
            }
        });
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
        LeaveYear year = LeaveYear.containing(employee.getJoinedOn(), from);
        if (to.isAfter(year.end())) {
            throw refused(HttpStatus.BAD_REQUEST, "Your leave year ends on " + Wording.date(year.end(), today())
                    + ". Split this into two requests, one each side of it.");
        }
        LeaveRequest related = related(employee, application);
        Integer notice = type.getNoticeDays();
        if (related == null && notice != null && from.isBefore(today().plusDays(notice))) {
            throw refused(HttpStatus.BAD_REQUEST, type.getName() + " is asked for " + notice + " days ahead. The earliest it can start is "
                    + Wording.date(today().plusDays(notice), today()) + ".");
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
        boolean isAmendment = related != null && LeaveRequest.AMENDED.equals(application.kind());
        if (requests.overlaps(employee.getId(), from, to, isAmendment ? related.getId() : "")) {
            throw refused(HttpStatus.CONFLICT, "You already have leave on some of those days.");
        }
        if (LeaveType.COMP_OFF.equals(type.getCode())) {
            List<LeaveRequest> others = requests.findByEmployeeIdAndTypeAndStatusIn(employee.getId(), type.getCode(), OPEN).stream()
                    .filter(request -> !isAmendment || !request.getId().equals(related.getId())).toList();
            if (!compOffDays(employee.getId(), others).take(new CompOffDays.Use(from, to, days))) {
                throw refused(HttpStatus.CONFLICT, "You don't have enough compensatory off for those dates. It's taken within "
                        + LeaveType.COMP_OFF_VALID_DAYS + " days of the day worked.");
            }
        } else if (!type.isUnlimited()) {
            openYear(employee.getId(), yearOf(employee.getId(), today()).number());
            Balance balance = balance(employee.getId(), type, entitlementFor(employee.getId(), type, year), year);
            boolean givesBack = isAmendment && related.getType().equals(type.getCode()) && year.contains(related.getFromDate());
            BigDecimal available = balance.entitled().subtract(balance.taken()).subtract(balance.pending())
                    .add(givesBack ? related.getDays() : BigDecimal.ZERO);
            if (days.compareTo(available) > 0) {
                String left = plural(available) + " of " + type.getName().toLowerCase() + " left.";
                throw refused(HttpStatus.CONFLICT, "You only have " + left);
            }
        }
        return new Checked(type, days);
    }

    // The request an amendment or extension changes: their own, still pending or approved. An amendment can't change
    // leave that's over; an extension follows straight on from the leave it extends, with no working day between.
    private LeaveRequest related(Employee employee, Application application) {
        if (LeaveRequest.INITIAL.equals(application.kind())) {
            return null;
        }
        boolean isAmendment = LeaveRequest.AMENDED.equals(application.kind());
        String doing = isAmendment ? "amending" : "extending";
        if (application.relatedId() == null) {
            throw refused(HttpStatus.BAD_REQUEST, "Pick the request you're " + doing + ".");
        }
        LeaveRequest original = ownRequest(employee, application.relatedId());
        if (!original.isPending() && !original.isApproved()) {
            throw refused(HttpStatus.CONFLICT, "That request was declined or cancelled, so there's nothing to change. Make a new request instead.");
        }
        if (isAmendment && original.getToDate().isBefore(today())) {
            throw refused(HttpStatus.CONFLICT, "That leave is over, so it can't be amended.");
        }
        LocalDate ends = original.getToDate();
        boolean followsOn = application.from().isAfter(ends)
                && WorkingDays.count(ends.plusDays(1), application.from().minusDays(1), false, holidays.datesBetween(ends, application.from())).signum() == 0;
        if (!isAmendment && !followsOn) {
            throw refused(HttpStatus.BAD_REQUEST, "An extension starts straight after the leave it extends, which ends on "
                    + Wording.date(ends, today()) + ". With a gap, it's a new request.");
        }
        return original;
    }

    // An approved amendment replaces the request it amends.
    private void replaceAmended(LeaveRequest request) {
        if (LeaveRequest.AMENDED.equals(request.getKind())) {
            requests.findById(request.getRelatedRequestId()).filter(original -> original.isPending() || original.isApproved())
                    .ifPresent(LeaveRequest::cancel);
        }
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
    private LeaveEntitlement entitlementFor(String employeeId, LeaveType type, LeaveYear year) {
        Supplier<ApiException> none = () -> refused(HttpStatus.BAD_REQUEST, "You don't have " + type.getName().toLowerCase() + " to take.");
        int current = yearOf(employeeId, today()).number();
        LeaveEntitlement held = entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), year.number()).orElseGet(() -> {
            boolean holdsItNow = entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), current)
                    .filter(entitlement -> !entitlement.isRemoved()).isPresent();
            if (year.number() <= current || !holdsItNow || type.getDefaultEntitlement() == null) {
                throw none.get();
            }
            return entitlements.save(LeaveEntitlement.fresh(employeeId, type.getCode(), year.number(), type.getDefaultEntitlement()));
        });
        if (held.isRemoved()) {
            throw none.get();
        }
        return held;
    }

    // A type with a balance that isn't retired. HR adjusts and sets days on these. Compensatory off only comes from days worked.
    private LeaveType bookableType(String code) {
        if (LeaveType.COMP_OFF.equals(code)) {
            throw refused(HttpStatus.BAD_REQUEST, "Compensatory off comes from Fridays and holidays worked, approved by the HOD.");
        }
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

    private Balance balance(String employeeId, LeaveType type, LeaveEntitlement entitlement, LeaveYear year) {
        BigDecimal carried = carriedInto(employeeId, type, year, CARRY_YEARS_BACK);
        BigDecimal pending = requests.daysIn(employeeId, type.getCode(), LeaveRequest.PENDING, year.start(), year.end());
        List<LeaveRequest> approved = requests.findByEmployeeIdAndTypeAndStatusAndFromDateBetween(employeeId, type.getCode(), LeaveRequest.APPROVED,
                year.start(), year.end());
        return new Balance(type.getCode(), entitlement.getEntitled().add(carried), taken(employeeId, entitlement, year), pending, carried,
                entitlement.getTakenBefore().add(daysToDate(approved)), null);
    }

    // Days still usable now, plus what this leave year's requests have used, so entitled minus taken and pending is what's left.
    private Balance compOffBalance(String employeeId, LeaveYear year) {
        List<LeaveRequest> open = requests.findByEmployeeIdAndTypeAndStatusIn(employeeId, LeaveType.COMP_OFF, OPEN);
        CompOffDays days = compOffDays(employeeId, open);
        List<LeaveRequest> approved = open.stream().filter(request -> request.isApproved() && year.contains(request.getFromDate())).toList();
        BigDecimal taken = sum(approved);
        BigDecimal pending = sum(open.stream().filter(request -> request.isPending() && year.contains(request.getFromDate())).toList());
        return new Balance(LeaveType.COMP_OFF, days.usableFrom(today()).add(taken).add(pending), taken, pending, BigDecimal.ZERO,
                daysToDate(approved), days.nextUseBy(today()));
    }

    private CompOffDays compOffDays(String employeeId, List<LeaveRequest> uses) {
        return new CompOffDays(compOffGrants.of(employeeId).stream().map(grant -> new CompOffDays.Earned(grant.workedOn(), grant.days())).toList(),
                uses.stream().map(request -> new CompOffDays.Use(request.getFromDate(), request.getToDate(), request.getDays())).toList());
    }

    // Approved days on or before today. Leave that's under way counts the working days so far.
    private BigDecimal daysToDate(List<LeaveRequest> approved) {
        LocalDate today = today();
        return approved.stream()
                .filter(request -> !request.getFromDate().isAfter(today))
                .map(request -> request.getToDate().isAfter(today)
                        ? WorkingDays.count(request.getFromDate(), today, request.getHalfDay() != null, holidays.datesBetween(request.getFromDate(), today))
                        : request.getDays())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal sum(List<LeaveRequest> requests) {
        return requests.stream().map(LeaveRequest::getDays).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal taken(String employeeId, LeaveEntitlement entitlement, LeaveYear year) {
        return entitlement.getTakenBefore().add(requests.daysIn(employeeId, entitlement.getType(), LeaveRequest.APPROVED, year.start(), year.end()));
    }

    // What's left of last year, up to the type's cap. Worked out every time, so a late change to last year still counts.
    private BigDecimal carriedInto(String employeeId, LeaveType type, LeaveYear year, int yearsBack) {
        if (!type.carriesForward() || yearsBack == 0) {
            return BigDecimal.ZERO;
        }
        LeaveYear last = year.previous();
        return entitlements.findByEmployeeIdAndTypeAndLeaveYear(employeeId, type.getCode(), last.number())
                .filter(previous -> !previous.isRemoved())
                .map(previous -> previous.getEntitled().add(carriedInto(employeeId, type, last, yearsBack - 1)).subtract(taken(employeeId, previous, last)))
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
                rules.documentRequiredAfterDays(), rules.isForEveryone(), rules.carriesForward(), rules.carryForwardCap(), rules.needsHrApproval(),
                rules.noticeDays());
    }

    private void checkName(String name, String code) {
        boolean isTaken = types().stream().anyMatch(type -> !type.isRetired() && !type.getCode().equals(code) && type.getName().equalsIgnoreCase(name.strip()));
        if (isTaken) {
            throw refused(HttpStatus.CONFLICT, "There's already a leave type called that.");
        }
    }

    private static String codeFor(String name) {
        String trimmed = Ids.codeFor(name, MAX_CODE_LENGTH);
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
