package mv.opro.hrms.attendance;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;
import mv.opro.hrms.common.WorkWeek;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.holiday.Holidays;
import mv.opro.hrms.leave.LeaveCalendar;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

// Development only. No biometric device is connected yet, so this fills the last few weeks with believable punches,
// the same way the mock does, and tops them up each time Spring starts. The same person and date always give the
// same punches. Real devices replace this entirely.
@Profile("dev")
@ConditionalOnProperty(name = "opro.dev.generate-punches", havingValue = "true")
@Component
class DevPunchSeeder implements ApplicationRunner {

    private static final int DAYS_OF_HISTORY = 62;
    private static final double ABSENT = 0.04;
    private static final double MISSED_OUT = 0.08;
    private static final double LATE = 0.2;
    private static final double HALF_DAY = 0.24;
    private static final double LUNCH = 0.5;
    private static final int MINUTES_PER_HOUR = 60;

    private final PunchRepository punches;
    private final DeviceRepository devices;
    private final WorkScheduleRepository schedules;
    private final People people;
    private final Holidays holidays;
    private final LeaveCalendar leave;
    private final Clock clock;

    DevPunchSeeder(PunchRepository punches, DeviceRepository devices, WorkScheduleRepository schedules, People people, Holidays holidays,
            LeaveCalendar leave, Clock clock) {
        this.punches = punches;
        this.devices = devices;
        this.schedules = schedules;
        this.people = people;
        this.holidays = holidays;
        this.leave = leave;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        ZoneId zone = clock.getZone();
        OffsetDateTime now = OffsetDateTime.now(clock);
        LocalDate today = now.toLocalDate();
        LocalDate first = today.minusDays(DAYS_OF_HISTORY - 1L);
        Set<LocalDate> holidayDates = holidays.datesBetween(first, today);
        WorkSchedule rules = schedules.findAll().getFirst();

        for (Employee employee : people.active()) {
            Set<LocalDate> leaveDays = leave.approvedFullDays(employee.getId(), first, today);
            String device = employee.getWorkLocation().equals("Hulhumalé site") ? "OPR-HMH-01" : "OPR-MLE-01";
            first.datesUntil(today.plusDays(1))
                    .filter(day -> !day.isBefore(employee.getJoinedOn()))
                    .filter(day -> !WorkWeek.isWeekend(day) && !holidayDates.contains(day) && !leaveDays.contains(day))
                    .filter(day -> !punches.existsByEmployeeIdAndPunchedAtGreaterThanEqualAndPunchedAtLessThan(employee.getId(),
                            day.atStartOfDay(zone).toOffsetDateTime(), day.plusDays(1).atStartOfDay(zone).toOffsetDateTime()))
                    .forEach(day -> punchesFor(employee.getId(), day, rules, day.equals(today) ? now.toLocalTime() : LocalTime.MAX).stream()
                            .map(minute -> Punch.fromDevice(employee.getId(), day.atStartOfDay(zone).plusMinutes(minute).toOffsetDateTime(), device))
                            .forEach(punches::save));
        }
        devices.findAll().forEach(each -> each.markSynced(now.minusMinutes(3)));
    }

    private static List<Integer> punchesFor(String employeeId, LocalDate day, WorkSchedule rules, LocalTime until) {
        String seed = employeeId + day;
        double roll = seeded(seed);
        boolean isToday = until != LocalTime.MAX;
        if (roll < ABSENT && !isToday) {
            return List.of();
        }
        int start = rules.getShiftStart().toSecondOfDay() / MINUTES_PER_HOUR;
        int end = rules.getShiftEnd().toSecondOfDay() / MINUTES_PER_HOUR;
        boolean isLate = roll >= MISSED_OUT && roll < LATE;
        boolean isHalfDay = roll >= LATE && roll < HALF_DAY;
        boolean missedOut = roll >= ABSENT && roll < MISSED_OUT && !isToday;
        int firstIn = isLate ? between(seed + "in", start + rules.getGraceMinutes() + 1, start + 50) : between(seed + "in", start - 20, start + 14);
        int lastOut = isHalfDay ? between(seed + "out", 12 * MINUTES_PER_HOUR + 20, 12 * MINUTES_PER_HOUR + 50) : between(seed + "out", end, end + 50);
        List<Integer> minutes = new ArrayList<>(List.of(firstIn));
        if (!isHalfDay && seeded(seed + "lunch") < LUNCH) {
            minutes.add(between(seed + "lo", 12 * MINUTES_PER_HOUR + 30, 12 * MINUTES_PER_HOUR + 55));
            minutes.add(between(seed + "li", 13 * MINUTES_PER_HOUR + 15, 13 * MINUTES_PER_HOUR + 40));
        }
        if (!missedOut) {
            minutes.add(lastOut);
        }
        int limit = isToday ? until.toSecondOfDay() / MINUTES_PER_HOUR : Integer.MAX_VALUE;
        return minutes.stream().filter(minute -> minute <= limit).toList();
    }

    private static int between(String seed, int min, int max) {
        return min + (int) Math.floor(seeded(seed) * (max - min));
    }

    // FNV-1a with a murmur style finish, so seeds that differ only at the end still spread evenly. Matches the mock.
    private static double seeded(String seed) {
        int hash = IntStream.range(0, seed.length()).reduce(0x811C9DC5, (acc, index) -> (acc ^ seed.charAt(index)) * 0x01000193);
        hash = (hash ^ (hash >>> 16)) * 0x85EBCA6B;
        hash = (hash ^ (hash >>> 13)) * 0xC2B2AE35;
        return Integer.toUnsignedLong(hash ^ (hash >>> 16)) / 4294967296.0;
    }
}
