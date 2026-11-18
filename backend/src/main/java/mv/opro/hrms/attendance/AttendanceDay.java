package mv.opro.hrms.attendance;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

// One day as the portal shows it. Field names match the frontend's AttendanceDay.
// workMode is office or home for days punched from the portal; homeStatus is the manager's decision on a home day.
// overtimeMinutes is time worked past the end of the shift on a working day, before the HOD decides on it.
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
        boolean isCorrected,
        String workMode,
        String homeStatus) {

    public record PunchView(OffsetDateTime at, String direction, String device) {}

    public AttendanceDay named(String name) {
        return new AttendanceDay(employeeId, name, date, status, punches, firstIn, lastOut, workedMinutes, overtimeMinutes, expectedOut,
                scheduledMinutes, isCorrected, workMode, homeStatus);
    }
}
