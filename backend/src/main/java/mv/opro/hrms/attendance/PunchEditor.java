package mv.opro.hrms.attendance;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// HR fixing punches by hand: add a missing one or void a wrong one. Device punches are never changed or deleted,
// every edit is logged, and the person is told. The day is worked out again on its next read.
@Service
@Transactional(readOnly = true)
public class PunchEditor {

    private final PunchRepository punches;
    private final PunchEditRepository edits;
    private final Notifications notifications;
    private final Clock clock;

    PunchEditor(PunchRepository punches, PunchEditRepository edits, Notifications notifications, Clock clock) {
        this.punches = punches;
        this.edits = edits;
        this.notifications = notifications;
        this.clock = clock;
    }

    public List<PunchEdit> of(String employeeId, YearMonth month) {
        return edits.findByEmployeeIdAndPunchDateBetweenOrderByMadeOnDescIdDesc(employeeId, month.atDay(1), month.atEndOfMonth());
    }

    @Transactional
    public PunchEdit edit(Employee hr, Employee employee, LocalDate date, String action, LocalTime time, String reason) {
        LocalDate today = LocalDate.now(clock);
        if (date.isAfter(today) || date.isBefore(employee.getJoinedOn())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pick a day they worked here that has already happened.");
        }
        OffsetDateTime at = date.atTime(time.truncatedTo(ChronoUnit.MINUTES)).atZone(clock.getZone()).toOffsetDateTime();
        List<Punch> sameMinute = punches.findByEmployeeIdAndPunchedAtGreaterThanEqualAndPunchedAtLessThanOrderByPunchedAt(employee.getId(), at,
                at.plusMinutes(1)).stream().filter(punch -> !punch.isVoided()).toList();
        if ("add".equals(action)) {
            if (!sameMinute.isEmpty()) {
                throw new ApiException(HttpStatus.CONFLICT, "There is already a punch at that time.");
            }
            punches.save(Punch.addedByHr(employee.getId(), at));
        } else {
            Punch wrong = sameMinute.stream().findFirst().orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No punch at that time."));
            wrong.voidBy(hr.getId(), OffsetDateTime.now(clock));
        }
        PunchEdit edit = edits.save(new PunchEdit(Ids.next("PE"), employee.getId(), date, action, time.truncatedTo(ChronoUnit.MINUTES), reason.strip(),
                hr.getId(), today));
        notifications.tell(employee.getId(), Notification.Kind.RECORD, "HR " + ("add".equals(action) ? "added" : "removed") + " a punch at "
                + Wording.time(edit.getPunchTime()) + " on " + Wording.date(date) + ". " + Wording.sentence(reason));
        return edit;
    }
}
