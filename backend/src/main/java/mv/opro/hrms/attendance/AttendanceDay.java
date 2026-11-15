package mv.opro.hrms.attendance;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

// One day as the portal shows it. Field names match the frontend's AttendanceDay.
public record AttendanceDay(
        String employeeId,
        String employeeName,
        LocalDate date,
        String status,
        List<PunchView> punches,
        OffsetDateTime firstIn,
        OffsetDateTime lastOut,
        long workedMinutes,
        long overtimeMinutes,
        OffsetDateTime expectedOut,
        Long scheduledMinutes,
        boolean isCorrected) {

    public record PunchView(OffsetDateTime at, String direction, String device) {}

    public AttendanceDay named(String name) {
        return new AttendanceDay(employeeId, name, date, status, punches, firstIn, lastOut, workedMinutes, overtimeMinutes, expectedOut,
                scheduledMinutes, isCorrected);
    }
}
