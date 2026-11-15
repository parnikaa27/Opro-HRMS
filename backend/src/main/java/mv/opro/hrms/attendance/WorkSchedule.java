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

    WorkSchedule(String id, LocalDate effectiveFrom, LocalTime shiftStart, LocalTime shiftEnd, int graceMinutes, int halfDayMinutes,
            LocalTime ramadanStart, LocalTime ramadanEnd, String reason, String setBy, LocalDate setOn) {
        this.id = id;
        this.effectiveFrom = effectiveFrom;
        this.shiftStart = shiftStart;
        this.shiftEnd = shiftEnd;
        this.graceMinutes = graceMinutes;
        this.halfDayMinutes = halfDayMinutes;
        this.ramadanStart = ramadanStart;
        this.ramadanEnd = ramadanEnd;
        this.reason = reason;
        this.setBy = setBy;
        this.setOn = setOn;
    }

    DayCalculator.Rules rules() {
        return new DayCalculator.Rules(shiftStart, shiftEnd, graceMinutes, halfDayMinutes);
    }

    public String getId() {
        return id;
    }

    public LocalTime getRamadanStart() {
        return ramadanStart;
    }

    public LocalTime getRamadanEnd() {
        return ramadanEnd;
    }

    public String getReason() {
        return reason;
    }

    public String getSetBy() {
        return setBy;
    }

    public LocalDate getSetOn() {
        return setOn;
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
