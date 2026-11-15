package mv.opro.hrms.attendance;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.leave.LeaveService;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Fridays and public holidays worked. The manager approves compensatory off for them: a full day, or half a day
// when the day worked was short, worked out from the punches when they decide.
@Service
@Transactional(readOnly = true)
public class CompOffs {

    private static final BigDecimal HALF = new BigDecimal("0.5");
    private static final String APPROVED = "approved";

    // A claim, with what it earns and the time worked that day.
    public record Claim(CompOffClaim claim, BigDecimal days, long workedMinutes) {}

    private final CompOffClaimRepository claims;
    private final EmployeeRepository employees;
    private final AttendanceService attendance;
    private final LeaveService leave;
    private final Notifications notifications;
    private final Clock clock;

    CompOffs(CompOffClaimRepository claims, EmployeeRepository employees, AttendanceService attendance, LeaveService leave, Notifications notifications,
            Clock clock) {
        this.claims = claims;
        this.employees = employees;
        this.attendance = attendance;
        this.leave = leave;
        this.notifications = notifications;
        this.clock = clock;
    }

    public List<Claim> of(Collection<String> employeeIds, String status) {
        List<CompOffClaim> found = status == null
                ? claims.findByEmployeeIdInOrderByWorkDateDesc(employeeIds)
                : claims.findByEmployeeIdInAndStatusOrderByWorkDateDesc(employeeIds, status);
        return found.stream().map(this::view).toList();
    }

    // Everyone's, for HR.
    public List<Claim> all(String status) {
        return (status == null ? claims.findAllByOrderByWorkDateDesc() : claims.findByStatusOrderByWorkDateDesc(status)).stream().map(this::view).toList();
    }

    @Transactional
    public Claim decide(Employee decider, String id, Collection<String> inScope, Corrections.Decision decision) {
        CompOffClaim claim = claims.findById(id).filter(found -> inScope.contains(found.getEmployeeId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Claim not found"));
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
            notifications.tell(claim.getEmployeeId(), Notification.Kind.LEAVE, decider.getFullName() + " didn't give compensatory off for working on "
                    + date + ": " + Wording.sentence(decision.note()));
            return view(claim);
        }
        AttendanceDay day = dayOf(claim);
        if (day == null || day.punches().isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "There are no punches on that day any more.");
        }
        if (day.punches().size() % 2 == 1) {
            throw new ApiException(HttpStatus.CONFLICT, "They haven't punched out that day yet. Approve it once they have, or fix their punches.");
        }
        BigDecimal days = earned(day);
        leave.earnCompOff(decider, claim.getEmployeeId(), claim.getWorkDate(), days);
        claim.approve(days, decider.getId(), today);
        notifications.tell(claim.getEmployeeId(), Notification.Kind.LEAVE, decider.getFullName() + " approved " + Wording.days(days)
                + " of compensatory off for working on " + date + ".");
        return view(claim);
    }

    private Claim view(CompOffClaim claim) {
        AttendanceDay day = dayOf(claim);
        BigDecimal days = claim.getDays() != null ? claim.getDays() : day == null || day.punches().isEmpty() ? BigDecimal.ZERO : earned(day);
        return new Claim(claim, days, day == null ? 0 : day.workedMinutes());
    }

    private AttendanceDay dayOf(CompOffClaim claim) {
        Employee employee = employees.findById(claim.getEmployeeId()).orElseThrow();
        return attendance.on(employee, claim.getWorkDate()).orElse(null);
    }

    // Under the half day threshold earns half a day. Anything more earns a full one.
    private static BigDecimal earned(AttendanceDay day) {
        return "half-day".equals(day.status()) ? HALF : BigDecimal.ONE;
    }
}
