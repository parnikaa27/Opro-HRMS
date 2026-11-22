package mv.opro.hrms.insight;

import java.util.List;
import java.util.Set;
import mv.opro.hrms.attendance.AttendanceDay;

// Days present, late arrivals, hours and on time share for any set of days: one person's month, or everyone's.
record MonthSummary(int workingDays, int present, int attendancePercent, long workedMinutes, int onTimePercent, int lateCount, int missed) {

    private static final Set<String> ATTENDED = Set.of("present", "late", "half-day", "incomplete", "not-in-yet");
    private static final Set<String> LATE = Set.of("late", "half-day");
    private static final Set<String> OFF = Set.of("weekend", "holiday", "on-leave");
    private static final Set<String> MISSED = Set.of("absent", "incomplete");

    static MonthSummary of(List<AttendanceDay> days) {
        List<AttendanceDay> working = days.stream().filter(day -> !OFF.contains(day.status())).toList();
        List<AttendanceDay> attended = working.stream().filter(day -> ATTENDED.contains(day.status()) && !day.punches().isEmpty()).toList();
        int late = (int) attended.stream().filter(day -> LATE.contains(day.status())).count();
        return new MonthSummary(working.size(), attended.size(), Facts.percentOf(attended.size(), working.size()),
                days.stream().mapToLong(AttendanceDay::workedMinutes).sum(), Facts.percentOf(attended.size() - late, attended.size()), late,
                (int) days.stream().filter(day -> MISSED.contains(day.status())).count());
    }
}
