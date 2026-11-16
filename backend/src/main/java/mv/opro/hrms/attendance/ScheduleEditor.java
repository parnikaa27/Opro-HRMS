package mv.opro.hrms.attendance;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Work schedule versions. A change only ever starts after today, so days already worked keep the rules they were worked under.
@Service
@Transactional(readOnly = true)
public class ScheduleEditor {

    private static final int MAX_GRACE_MINUTES = 60;

    public record Rules(LocalDate effectiveFrom, LocalTime shiftStart, LocalTime shiftEnd, int graceMinutes, int halfDayMinutes) {}

    private final WorkScheduleRepository schedules;
    private final Notifications notifications;
    private final Clock clock;

    ScheduleEditor(WorkScheduleRepository schedules, Notifications notifications, Clock clock) {
        this.schedules = schedules;
        this.notifications = notifications;
        this.clock = clock;
    }

    public List<WorkSchedule> newestFirst() {
        return schedules.findAll(Sort.by(Sort.Direction.DESC, "effectiveFrom"));
    }

    @Transactional
    public WorkSchedule add(Employee hr, Rules rules, String reason) {
        LocalDate today = LocalDate.now(clock);
        if (!rules.effectiveFrom().isAfter(today)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "A new schedule can only start after today.");
        }
        if (!rules.shiftEnd().isAfter(rules.shiftStart())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "A shift has to end after it starts.");
        }
        long shiftMinutes = Duration.between(rules.shiftStart(), rules.shiftEnd()).toMinutes();
        if (rules.graceMinutes() < 0 || rules.graceMinutes() > MAX_GRACE_MINUTES || rules.halfDayMinutes() <= 0 || rules.halfDayMinutes() >= shiftMinutes) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Grace has to be 0 to 60 minutes, and a half day shorter than the shift.");
        }
        if (newestFirst().stream().anyMatch(version -> version.getEffectiveFrom().equals(rules.effectiveFrom()))) {
            throw new ApiException(HttpStatus.CONFLICT, "A schedule already starts on that date.");
        }
        WorkSchedule version = schedules.save(new WorkSchedule(Ids.next("WS"), rules.effectiveFrom(), rules.shiftStart(), rules.shiftEnd(),
                rules.graceMinutes(), rules.halfDayMinutes(), reason.strip(), hr.getId(), today));
        notifications.tellEveryone(Notification.Kind.SCHEDULE, "From " + Wording.date(rules.effectiveFrom()) + ", the working day is "
                + Wording.time(rules.shiftStart()) + " to " + Wording.time(rules.shiftEnd()) + ", late after " + rules.graceMinutes() + " minutes. "
                + Wording.sentence(reason));
        return version;
    }

    // Only a change that hasn't started can be taken back. One already in force can only be replaced.
    @Transactional
    public void cancel(String id) {
        WorkSchedule version = schedules.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Schedule not found"));
        if (!version.getEffectiveFrom().isAfter(LocalDate.now(clock))) {
            throw new ApiException(HttpStatus.CONFLICT, "A schedule already in force can only be replaced, not removed.");
        }
        schedules.delete(version);
        notifications.tellEveryone(Notification.Kind.SCHEDULE,
                "The change to working hours planned for " + Wording.date(version.getEffectiveFrom()) + " is off. Your hours stay as they are.");
    }
}
