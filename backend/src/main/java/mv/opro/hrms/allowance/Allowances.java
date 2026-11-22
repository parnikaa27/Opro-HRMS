package mv.opro.hrms.allowance;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Allowances on top of pay, kept for payroll: what someone gets every month, which HR sets, and one-off amounts an HOD
// grants that HR approves. Only the person and HR see them. Nothing pays out until payroll exists.
@Service
@Transactional(readOnly = true)
public class Allowances {

    private static final int MAX_CODE_LENGTH = 40;
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.UK);

    public record Monthly(String typeCode, BigDecimal amount, String currency, LocalDate startsOn, String note) {}

    public record Grant(String typeCode, BigDecimal amount, String currency, String reason) {}

    private final AllowanceTypeRepository types;
    private final MonthlyAllowanceRepository monthly;
    private final AllowanceGrantRepository grants;
    private final People people;
    private final Notifications notifications;
    private final Clock clock;

    Allowances(AllowanceTypeRepository types, MonthlyAllowanceRepository monthly, AllowanceGrantRepository grants, People people, Notifications notifications,
            Clock clock) {
        this.types = types;
        this.monthly = monthly;
        this.grants = grants;
        this.people = people;
        this.notifications = notifications;
        this.clock = clock;
    }

    public List<AllowanceType> types() {
        return types.findAllByOrderBySortOrderAscNameAsc();
    }

    public List<MonthlyAllowance> monthlyOf(String employeeId) {
        return monthly.findByEmployeeIdOrderByStartsOnDescIdDesc(employeeId);
    }

    public List<AllowanceGrant> grantsOf(String employeeId) {
        return grants.findByEmployeeIdOrderByGrantedOnDescIdDesc(employeeId);
    }

    public List<AllowanceGrant> grantsOf(Collection<String> employeeIds) {
        return grants.findByEmployeeIdInOrderByGrantedOnDescIdDesc(employeeIds);
    }

    // Sets what someone gets of one kind from a month on. An amount already running ends the month before; one that
    // hasn't started by then is replaced. The person is told.
    @Transactional
    public MonthlyAllowance setMonthly(Employee hr, String employeeId, Monthly change) {
        AllowanceType type = activeType(change.typeCode());
        if (change.startsOn().getDayOfMonth() != 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Allowances start on the first of a month.");
        }
        monthly.findByEmployeeIdAndTypeCodeAndEndsOnIsNull(employeeId, type.getCode()).ifPresent(current -> {
            if (current.getStartsOn().isBefore(change.startsOn())) {
                current.end(change.startsOn().minusDays(1));
            } else {
                monthly.delete(current);
                monthly.flush();
            }
        });
        MonthlyAllowance saved = monthly.save(new MonthlyAllowance(Ids.next("MA"), employeeId, type.getCode(), change.amount(), change.currency(),
                change.startsOn(), blankToNull(change.note()), hr.getId(), today()));
        notifications.tell(employeeId, Notification.Kind.RECORD, "HR set your " + lower(type) + " allowance to " + money(change.amount(), change.currency())
                + " a month from " + change.startsOn().format(MONTH) + ".");
        return saved;
    }

    // Stops one after a month: the last month it's paid.
    @Transactional
    public MonthlyAllowance stopMonthly(String employeeId, String typeCode, YearMonth lastMonth) {
        AllowanceType type = types.findById(typeCode).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Allowance type not found"));
        MonthlyAllowance current = monthly.findByEmployeeIdAndTypeCodeAndEndsOnIsNull(employeeId, typeCode)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "They don't get a " + lower(type) + " allowance."));
        LocalDate endsOn = lastMonth.atEndOfMonth();
        if (endsOn.isBefore(current.getStartsOn())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pick a month from " + current.getStartsOn().format(MONTH) + " on.");
        }
        current.end(endsOn);
        notifications.tell(employeeId, Notification.Kind.RECORD, "HR stopped your " + lower(type) + " allowance after " + lastMonth.format(MONTH) + ".");
        return current;
    }

    // An HOD grants a report a one-off amount. HR approves it, unless the HOD is HR: then it's approved as it's made.
    @Transactional
    public AllowanceGrant grant(Employee hod, String employeeId, Grant grant) {
        AllowanceType type = activeType(grant.typeCode());
        AllowanceGrant saved = grants.save(new AllowanceGrant(Ids.next("AG"), employeeId, type.getCode(), grant.amount(), grant.currency(),
                grant.reason().strip(), hod.getId(), today()));
        if (hod.isHr()) {
            return approve(hod, saved);
        }
        String name = people.namesOf(List.of(employeeId)).get(employeeId);
        people.active().stream().filter(Employee::isHr).filter(hr -> !hr.getId().equals(employeeId))
                .forEach(hr -> notifications.tell(hr.getId(), Notification.Kind.APPROVAL, hod.getFullName() + " granted " + name + " "
                        + money(grant.amount(), grant.currency()) + " of " + lower(type) + " allowance. Decide it from Inbox."));
        return saved;
    }

    // Waiting for HR, never the reader's own.
    public List<AllowanceGrant> waitingForHr(Employee hr) {
        return grants.findByStatusOrderByGrantedOn(AllowanceGrant.PENDING).stream().filter(grant -> !grant.getEmployeeId().equals(hr.getId())).toList();
    }

    @Transactional
    public AllowanceGrant decide(Employee hr, String id, boolean isApproved, String note) {
        AllowanceGrant grant = grants.findById(id).filter(AllowanceGrant::isPending)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Nothing waiting for HR with that id"));
        if (hr.getId().equals(grant.getEmployeeId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Your own requests go to another HR person.");
        }
        if (isApproved) {
            return approve(hr, grant);
        }
        String clean = blankToNull(note);
        if (clean == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Give a short reason so the HOD knows why.");
        }
        grant.decide(false, hr.getId(), today(), clean);
        notifications.tell(grant.getGrantedBy(), Notification.Kind.RECORD, "HR didn't approve the " + lower(typeOf(grant.getTypeCode())) + " allowance for "
                + people.namesOf(List.of(grant.getEmployeeId())).get(grant.getEmployeeId()) + ": " + Wording.sentence(clean));
        return grant;
    }

    private AllowanceType typeOf(String code) {
        return types.findById(code).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Allowance type not found"));
    }

    @Transactional
    public AllowanceType addType(String name) {
        String code = Ids.codeFor(name, MAX_CODE_LENGTH);
        if (code.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Give the allowance a name with letters or numbers.");
        }
        boolean isTaken = types().stream().anyMatch(type -> !type.isRetired() && type.getName().equalsIgnoreCase(name.strip()));
        if (isTaken || types.existsById(code)) {
            throw new ApiException(HttpStatus.CONFLICT, "There's already an allowance called that.");
        }
        int sortOrder = types().stream().mapToInt(AllowanceType::getSortOrder).max().orElse(0) + 1;
        return types.save(new AllowanceType(code, name.strip(), sortOrder));
    }

    // Never used, it's deleted. Used, it's retired: nobody can be given it, and history keeps its name.
    @Transactional
    public void removeType(String code) {
        AllowanceType type = activeType(code);
        if (monthly.existsByTypeCode(code) || grants.existsByTypeCode(code)) {
            type.retire(today());
        } else {
            types.delete(type);
        }
    }

    private AllowanceGrant approve(Employee by, AllowanceGrant grant) {
        grant.decide(true, by.getId(), today(), null);
        notifications.tell(grant.getEmployeeId(), Notification.Kind.RECORD, "You've been granted " + money(grant.getAmount(), grant.getCurrency()) + " of "
                + lower(typeOf(grant.getTypeCode())) + " allowance: " + Wording.sentence(grant.getReason()));
        return grant;
    }

    private AllowanceType activeType(String code) {
        return types.findById(code).filter(type -> !type.isRetired())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Pick a kind of allowance from the list."));
    }

    // "MVR 6,000" or "USD 400.50"
    static String money(BigDecimal amount, String currency) {
        DecimalFormat format = new DecimalFormat("#,##0.##", DecimalFormatSymbols.getInstance(Locale.UK));
        return currency + " " + format.format(amount.setScale(2, RoundingMode.HALF_UP));
    }

    private static String lower(AllowanceType type) {
        return type.getName().toLowerCase(Locale.ROOT);
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}
