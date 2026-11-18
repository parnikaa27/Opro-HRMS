package mv.opro.hrms.attendance;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;
import java.util.stream.IntStream;

// Works out one day from its punches. Pure, so every rule can be tested without a database.
// The frontend never does this: it only shows what comes back.
final class DayCalculator {

    enum OffDay { NONE, WEEKEND, HOLIDAY, ON_LEAVE }

    // Less than this past the shift isn't overtime. Placeholder until HR confirms it.
    static final int MIN_OVERTIME_MINUTES = 30;

    record Rules(LocalTime shiftStart, LocalTime shiftEnd, int graceMinutes, int halfDayMinutes) {

        long shiftMinutes() {
            return Duration.between(shiftStart, shiftEnd).toMinutes();
        }
    }

    // A punch as stored: its time in Maldives time, where it came from, whether it was changed by hand,
    // and office or home for a punch from the portal.
    record DayPunch(OffsetDateTime at, String device, boolean manual, boolean voided, String mode) {}

    private DayCalculator() {}

    // homeStatus is the manager's decision on a day worked from home, or null.
    static AttendanceDay work(String employeeId, LocalDate date, LocalDate today, List<DayPunch> punches, Rules rules, OffDay offDay, String homeStatus) {
        boolean isCorrected = punches.stream().anyMatch(punch -> punch.manual() || punch.voided());
        // Breaks mean many punches a day. Voided ones are ignored, the rest pair up in order: in, out, in, out.
        List<DayPunch> live = punches.stream().filter(punch -> !punch.voided()).sorted((first, second) -> first.at().compareTo(second.at())).toList();
        List<AttendanceDay.PunchView> views = IntStream.range(0, live.size())
                .mapToObj(index -> new AttendanceDay.PunchView(live.get(index).at(), index % 2 == 0 ? "in" : "out", live.get(index).device()))
                .toList();

        if (live.isEmpty()) {
            return new AttendanceDay(employeeId, null, date, emptyStatus(date, today, offDay), views, null, null, 0, 0, null, null, isCorrected, null, null);
        }
        String workMode = live.stream().map(DayPunch::mode).filter(Objects::nonNull).findFirst().orElse(null);
        String home = "home".equals(workMode) ? homeStatus : null;
        // A declined home day counts as absent, whatever was punched.
        if ("rejected".equals(home)) {
            return new AttendanceDay(employeeId, null, date, "absent", views, null, null, 0, 0, null, null, isCorrected, workMode, home);
        }

        boolean isComplete = live.size() % 2 == 0;
        OffsetDateTime firstIn = live.getFirst().at();
        OffsetDateTime lastOut = isComplete ? live.getLast().at() : null;
        long worked = isComplete ? workedMinutes(live) : 0;
        boolean isLate = firstIn.toLocalTime().isAfter(rules.shiftStart().plusMinutes(rules.graceMinutes()));

        String status;
        if (!isComplete) {
            // Still in the office today, or forgot to punch out on an earlier day.
            status = date.equals(today) ? (isLate ? "late" : "present") : "incomplete";
        } else if (worked < rules.halfDayMinutes()) {
            status = "half-day";
        } else {
            status = isLate ? "late" : "present";
        }
        long overtime = isComplete && offDay == OffDay.NONE ? overtimeMinutes(live, rules, worked) : 0;
        return new AttendanceDay(employeeId, null, date, status, views, firstIn, lastOut, worked, overtime,
                firstIn.plusMinutes(rules.shiftMinutes()), rules.shiftMinutes(), isCorrected, workMode, home);
    }

    private static String emptyStatus(LocalDate date, LocalDate today, OffDay offDay) {
        return switch (offDay) {
            case WEEKEND -> "weekend";
            case HOLIDAY -> "holiday";
            case ON_LEAVE -> "on-leave";
            case NONE -> date.equals(today) ? "not-in-yet" : "absent";
        };
    }

    // Time worked after the shift ends, but never more than the day's hours were exceeded by:
    // staying late to make up for a late start isn't overtime, and neither is coming in early.
    private static long overtimeMinutes(List<DayPunch> live, Rules rules, long worked) {
        OffsetDateTime shiftEnd = live.getFirst().at().with(rules.shiftEnd());
        long afterShift = IntStream.range(0, live.size() / 2)
                .mapToLong(pair -> {
                    OffsetDateTime from = live.get(pair * 2).at().isAfter(shiftEnd) ? live.get(pair * 2).at() : shiftEnd;
                    OffsetDateTime to = live.get(pair * 2 + 1).at();
                    return to.isAfter(from) ? Duration.between(from, to).toMinutes() : 0;
                })
                .sum();
        long overtime = Math.min(afterShift, worked - rules.shiftMinutes());
        return overtime >= MIN_OVERTIME_MINUTES ? overtime : 0;
    }

    private static long workedMinutes(List<DayPunch> live) {
        return IntStream.range(0, live.size() / 2)
                .mapToLong(pair -> Duration.between(live.get(pair * 2).at(), live.get(pair * 2 + 1).at()).toMinutes())
                .sum();
    }
}
