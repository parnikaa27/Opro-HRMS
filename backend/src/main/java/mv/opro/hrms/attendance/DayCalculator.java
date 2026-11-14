package mv.opro.hrms.attendance;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.IntStream;

// Works out one day from its punches. Pure, so every rule can be tested without a database.
// The frontend never does this: it only shows what comes back.
final class DayCalculator {

    enum OffDay { NONE, WEEKEND, HOLIDAY, ON_LEAVE }

    record Rules(LocalTime shiftStart, LocalTime shiftEnd, int graceMinutes, int halfDayMinutes) {

        long shiftMinutes() {
            return Duration.between(shiftStart, shiftEnd).toMinutes();
        }
    }

    // A punch as stored: its time in Maldives time, the device it came from, and whether it was changed by hand.
    record DayPunch(OffsetDateTime at, String device, boolean manual, boolean voided) {}

    private DayCalculator() {}

    static AttendanceDay work(String employeeId, LocalDate date, LocalDate today, List<DayPunch> punches, Rules rules, OffDay offDay) {
        boolean isCorrected = punches.stream().anyMatch(punch -> punch.manual() || punch.voided());
        // Breaks mean many punches a day. Voided ones are ignored, the rest pair up in order: in, out, in, out.
        List<DayPunch> live = punches.stream().filter(punch -> !punch.voided()).sorted((first, second) -> first.at().compareTo(second.at())).toList();
        List<AttendanceDay.PunchView> views = IntStream.range(0, live.size())
                .mapToObj(index -> new AttendanceDay.PunchView(live.get(index).at(), index % 2 == 0 ? "in" : "out", live.get(index).device()))
                .toList();

        if (live.isEmpty()) {
            return new AttendanceDay(employeeId, null, date, emptyStatus(date, today, offDay), views, null, null, 0, 0, null, null, isCorrected);
        }

        boolean isComplete = live.size() % 2 == 0;
        OffsetDateTime firstIn = live.getFirst().at();
        OffsetDateTime lastOut = isComplete ? live.getLast().at() : null;
        long worked = isComplete ? workedMinutes(live) : 0;
        long overtime = lastOut == null ? 0 : Math.max(0, Duration.between(rules.shiftEnd(), lastOut.toLocalTime()).toMinutes());
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
        return new AttendanceDay(employeeId, null, date, status, views, firstIn, lastOut, worked, overtime,
                firstIn.plusMinutes(rules.shiftMinutes()), rules.shiftMinutes(), isCorrected);
    }

    private static String emptyStatus(LocalDate date, LocalDate today, OffDay offDay) {
        return switch (offDay) {
            case WEEKEND -> "weekend";
            case HOLIDAY -> "holiday";
            case ON_LEAVE -> "on-leave";
            case NONE -> date.equals(today) ? "not-in-yet" : "absent";
        };
    }

    private static long workedMinutes(List<DayPunch> live) {
        return IntStream.range(0, live.size() / 2)
                .mapToLong(pair -> Duration.between(live.get(pair * 2).at(), live.get(pair * 2 + 1).at()).toMinutes())
                .sum();
    }
}
