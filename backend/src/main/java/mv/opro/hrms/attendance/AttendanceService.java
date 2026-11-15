package mv.opro.hrms.attendance;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.common.WorkWeek;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.holiday.Holidays;
import mv.opro.hrms.leave.LeaveCalendar;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// A person's month, day by day, from the punches, the schedule in force, holidays and approved leave.
@Service
@Transactional(readOnly = true)
public class AttendanceService {

    private final PunchRepository punches;
    private final WorkScheduleRepository schedules;
    private final DeviceRepository devices;
    private final HomeDayRepository homeDays;
    private final Holidays holidays;
    private final LeaveCalendar leave;
    private final Clock clock;

    AttendanceService(PunchRepository punches, WorkScheduleRepository schedules, DeviceRepository devices, HomeDayRepository homeDays, Holidays holidays,
            LeaveCalendar leave, Clock clock) {
        this.punches = punches;
        this.schedules = schedules;
        this.devices = devices;
        this.homeDays = homeDays;
        this.holidays = holidays;
        this.leave = leave;
        this.clock = clock;
    }

    public List<AttendanceDay> month(Employee employee, YearMonth month) {
        return between(employee, month.atDay(1), month.atEndOfMonth());
    }

    public List<AttendanceDay> today(Employee employee) {
        LocalDate today = LocalDate.now(clock);
        return between(employee, today, today);
    }

    private List<AttendanceDay> between(Employee employee, LocalDate first, LocalDate last) {
        LocalDate today = LocalDate.now(clock);
        // Only days they worked here, and none still to come.
        LocalDate from = latest(first, employee.getJoinedOn());
        LocalDate to = earliest(last, today, employee.getLastDay());
        if (from.isAfter(to)) {
            return List.of();
        }
        ZoneId zone = clock.getZone();
        Map<String, String> deviceNames = devices.findAll().stream().collect(Collectors.toMap(Device::getId, Device::getName));
        Map<LocalDate, List<DayCalculator.DayPunch>> punchesByDay = punches
                .findByEmployeeIdAndPunchedAtGreaterThanEqualAndPunchedAtLessThanOrderByPunchedAt(
                        employee.getId(), from.atStartOfDay(zone).toOffsetDateTime(), to.plusDays(1).atStartOfDay(zone).toOffsetDateTime())
                .stream()
                .map(punch -> {
                    OffsetDateTime local = punch.getPunchedAt().atZoneSameInstant(zone).toOffsetDateTime();
                    return new DayCalculator.DayPunch(local, placeOf(punch, deviceNames), punch.isManual(), punch.isVoided(), punch.getWorkMode());
                })
                .collect(Collectors.groupingBy(punch -> punch.at().toLocalDate()));
        Map<LocalDate, String> homeStatus = homeDays.findByEmployeeIdAndWorkDateBetween(employee.getId(), from, to).stream()
                .collect(Collectors.toMap(HomeDay::getWorkDate, HomeDay::getStatus));
        Set<LocalDate> holidayDates = holidays.datesBetween(from, to);
        Set<LocalDate> leaveDays = leave.approvedFullDays(employee.getId(), from, to);
        List<WorkSchedule> versions = schedules.findAll(Sort.by(Sort.Direction.DESC, "effectiveFrom"));
        Map<LocalDate, DayCalculator.Rules> rules = from.datesUntil(to.plusDays(1))
                .collect(Collectors.toMap(Function.identity(), day -> rulesOn(versions, day)));

        return from.datesUntil(to.plusDays(1))
                .map(day -> DayCalculator.work(employee.getId(), day, today, punchesByDay.getOrDefault(day, List.of()), rules.get(day),
                        offDay(day, holidayDates, leaveDays), homeStatus.get(day)))
                .toList();
    }

    // Where a punch was made, as the log shows it: the office or "Home" for a portal punch, the device's name for an old one.
    private static String placeOf(Punch punch, Map<String, String> deviceNames) {
        if (punch.getWorkMode() == null) {
            return deviceNames.get(punch.getDeviceId());
        }
        return PunchClock.HOME.equals(punch.getWorkMode()) ? "Home" : punch.getOffice();
    }

    // The version in force on a day: the newest one that started on or before it.
    private static DayCalculator.Rules rulesOn(List<WorkSchedule> newestFirst, LocalDate day) {
        return newestFirst.stream()
                .filter(version -> !version.getEffectiveFrom().isAfter(day))
                .findFirst()
                .map(WorkSchedule::rules)
                .orElseThrow(() -> new IllegalStateException("No work schedule in force on " + day));
    }

    private static DayCalculator.OffDay offDay(LocalDate day, Set<LocalDate> holidays, Set<LocalDate> leave) {
        if (WorkWeek.isWeekend(day)) {
            return DayCalculator.OffDay.WEEKEND;
        }
        if (holidays.contains(day)) {
            return DayCalculator.OffDay.HOLIDAY;
        }
        return leave.contains(day) ? DayCalculator.OffDay.ON_LEAVE : DayCalculator.OffDay.NONE;
    }

    private static LocalDate latest(LocalDate first, LocalDate second) {
        return first.isAfter(second) ? first : second;
    }

    private static LocalDate earliest(LocalDate... days) {
        return Stream.of(days).filter(day -> day != null).min(LocalDate::compareTo).orElseThrow();
    }
}
