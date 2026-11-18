package mv.opro.hrms.attendance;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Time worked past the shift on a working day. Raised by itself when the punches show it, decided by the HOD.
// Approving keeps the minutes the punches show then, ready for payroll.
@Service
@Transactional(readOnly = true)
public class Overtimes {

    private static final String APPROVED = "approved";
    private static final int MINUTES_PER_HOUR = 60;

    // A claim, with its minutes: approved, or what the day's punches show now.
    public record Claim(OvertimeClaim claim, long minutes) {}

    private final OvertimeClaimRepository claims;
    private final EmployeeRepository employees;
    private final People people;
    private final AttendanceService attendance;
    private final Notifications notifications;
    private final Clock clock;

    Overtimes(OvertimeClaimRepository claims, EmployeeRepository employees, People people, AttendanceService attendance, Notifications notifications,
            Clock clock) {
        this.claims = claims;
        this.employees = employees;
        this.people = people;
        this.attendance = attendance;
        this.notifications = notifications;
        this.clock = clock;
    }

    public List<Claim> of(Collection<String> employeeIds, String status) {
        List<OvertimeClaim> found = status == null
                ? claims.findByEmployeeIdInOrderByWorkDateDesc(employeeIds)
                : claims.findByEmployeeIdInAndStatusOrderByWorkDateDesc(employeeIds, status);
        return found.stream().map(this::view).toList();
    }

    // Once a day shows overtime, its HOD is asked, once. Super admins have nobody to ask.
    @Transactional
    void raise(String employeeId, LocalDate date) {
        Employee employee = employees.findById(employeeId).orElseThrow();
        if (employee.isSuperAdmin() || claims.existsByEmployeeIdAndWorkDate(employeeId, date)) {
            return;
        }
        long minutes = attendance.on(employee, date).map(AttendanceDay::overtimeMinutes).orElse(0L);
        if (minutes == 0) {
            return;
        }
        claims.save(new OvertimeClaim(Ids.next("OT"), employeeId, date));
        String managerId = employee.getManagerId();
        if (managerId != null && people.findActive(managerId).isPresent()) {
            notifications.tell(managerId, Notification.Kind.APPROVAL, employee.getFullName() + " worked " + duration(minutes) + " past the shift on "
                    + Wording.date(date) + ". Approve the overtime from Leave requests.");
        }
    }

    @Transactional
    public Claim decide(Employee decider, String id, Collection<String> inScope, Corrections.Decision decision) {
        OvertimeClaim claim = claims.findById(id).filter(found -> inScope.contains(found.getEmployeeId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Overtime not found"));
        if (!claim.isPending()) {
            throw new ApiException(HttpStatus.CONFLICT, "This day has already been decided.");
        }
        String date = Wording.date(claim.getWorkDate());
        LocalDate today = LocalDate.now(clock);
        if (!APPROVED.equals(decision.decision())) {
            if (decision.note() == null || decision.note().isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Give a short reason so they know why.");
            }
            claim.reject(decider.getId(), today, decision.note().strip());
            notifications.tell(claim.getEmployeeId(), Notification.Kind.OVERTIME, decider.getFullName() + " didn't approve overtime on " + date + ": "
                    + Wording.sentence(decision.note()));
            return view(claim);
        }
        long minutes = minutesNow(claim);
        if (minutes == 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Their punches that day no longer show half an hour past the shift. Decline it, or fix their punches.");
        }
        claim.approve(Math.toIntExact(minutes), decider.getId(), today);
        notifications.tell(claim.getEmployeeId(), Notification.Kind.OVERTIME, decider.getFullName() + " approved " + duration(minutes)
                + " of overtime on " + date + ".");
        return view(claim);
    }

    private Claim view(OvertimeClaim claim) {
        return new Claim(claim, claim.getMinutes() != null ? claim.getMinutes() : minutesNow(claim));
    }

    private long minutesNow(OvertimeClaim claim) {
        Employee employee = employees.findById(claim.getEmployeeId()).orElseThrow();
        return attendance.on(employee, claim.getWorkDate()).map(AttendanceDay::overtimeMinutes).orElse(0L);
    }

    // "45 minutes", "2h", "1h 40m"
    private static String duration(long minutes) {
        long hours = minutes / MINUTES_PER_HOUR;
        long rest = minutes % MINUTES_PER_HOUR;
        return hours == 0 ? minutes + " minutes" : rest == 0 ? hours + "h" : hours + "h " + rest + "m";
    }
}
