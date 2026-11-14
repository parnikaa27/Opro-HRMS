package mv.opro.hrms.attendance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
public class WorkSchedule {

    @Id
    private String id;

    private LocalDate effectiveFrom;
    private LocalTime shiftStart;
    private LocalTime shiftEnd;
    private int graceMinutes;
    private int halfDayMinutes;
    private LocalTime ramadanStart;
    private LocalTime ramadanEnd;
    private String reason;
    private String setBy;
    private LocalDate setOn;

    protected WorkSchedule() {}

    DayCalculator.Rules rules() {
        return new DayCalculator.Rules(shiftStart, shiftEnd, graceMinutes, halfDayMinutes);
    }

    public LocalDate getEffectiveFrom() {
        return effectiveFrom;
    }

    public LocalTime getShiftStart() {
        return shiftStart;
    }

    public LocalTime getShiftEnd() {
        return shiftEnd;
    }

    public int getGraceMinutes() {
        return graceMinutes;
    }

    public int getHalfDayMinutes() {
        return halfDayMinutes;
    }
}
