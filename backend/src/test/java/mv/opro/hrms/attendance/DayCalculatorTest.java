package mv.opro.hrms.attendance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import mv.opro.hrms.attendance.DayCalculator.DayPunch;
import mv.opro.hrms.attendance.DayCalculator.OffDay;
import mv.opro.hrms.attendance.DayCalculator.Rules;
import org.junit.jupiter.api.Test;

class DayCalculatorTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 10);
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 12);
    private static final Rules RULES = new Rules(LocalTime.of(9, 0), LocalTime.of(17, 0), 15, 240);

    private static DayPunch at(String time) {
        return new DayPunch(OffsetDateTime.of(DAY, LocalTime.parse(time), ZoneOffset.ofHours(5)), "Front desk", false, false, null);
    }

    private static AttendanceDay work(List<DayPunch> punches) {
        return DayCalculator.work("OPR-0018", DAY, TODAY, punches, RULES, OffDay.NONE, null);
    }

    @Test
    void aFullDayWithALunchBreakIsPresent() {
        AttendanceDay day = work(List.of(at("08:55"), at("12:30"), at("13:15"), at("17:20")));

        assertThat(day.status()).isEqualTo("present");
        assertThat(day.workedMinutes()).isEqualTo(460);
        assertThat(day.punches()).extracting(AttendanceDay.PunchView::direction).containsExactly("in", "out", "in", "out");
        assertThat(day.expectedOut().toLocalTime()).isEqualTo(LocalTime.of(16, 55));
        assertThat(day.scheduledMinutes()).isEqualTo(480);
        assertThat(day.isCorrected()).isFalse();
    }

    @Test
    void overtimeIsTimeAfterTheShiftEndsOnceItReachesHalfAnHour() {
        assertThat(work(List.of(at("08:55"), at("18:10"))).overtimeMinutes()).isEqualTo(70);
        assertThat(work(List.of(at("08:55"), at("17:29"))).overtimeMinutes()).isZero();
        assertThat(work(List.of(at("08:55"), at("12:30"), at("17:30"), at("19:00"))).overtimeMinutes()).isZero();
    }

    @Test
    void comingInEarlyOrStayingLateToMakeUpALateStartIsNotOvertime() {
        assertThat(work(List.of(at("07:00"), at("17:00"))).overtimeMinutes()).isZero();
        assertThat(work(List.of(at("10:00"), at("18:00"))).overtimeMinutes()).isZero();
        assertThat(work(List.of(at("09:30"), at("18:00"))).overtimeMinutes()).isEqualTo(30);
    }

    @Test
    void daysOffAndUnfinishedDaysHaveNoOvertime() {
        List<DayPunch> late = List.of(at("09:00"), at("19:00"));

        assertThat(DayCalculator.work("OPR-0018", DAY, TODAY, late, RULES, OffDay.HOLIDAY, null).overtimeMinutes()).isZero();
        assertThat(work(List.of(at("09:00"), at("18:00"), at("18:30"))).overtimeMinutes()).isZero();
    }

    @Test
    void theGracePeriodDecidesLate() {
        assertThat(work(List.of(at("09:15"), at("17:30"))).status()).isEqualTo("present");
        assertThat(work(List.of(at("09:16"), at("17:30"))).status()).isEqualTo("late");
    }

    @Test
    void underTheHalfDayThresholdIsAHalfDay() {
        assertThat(work(List.of(at("09:00"), at("12:59"))).status()).isEqualTo("half-day");
    }

    @Test
    void aMissingOutPunchOnAPastDayIsIncompleteAndCountsNoHours() {
        AttendanceDay day = work(List.of(at("08:50")));

        assertThat(day.status()).isEqualTo("incomplete");
        assertThat(day.workedMinutes()).isZero();
        assertThat(day.lastOut()).isNull();
    }

    @Test
    void stillInTheOfficeTodayIsPresentOrLate() {
        DayPunch morning = new DayPunch(OffsetDateTime.of(TODAY, LocalTime.of(9, 40), ZoneOffset.ofHours(5)), "Front desk", false, false, null);

        assertThat(DayCalculator.work("OPR-0018", TODAY, TODAY, List.of(morning), RULES, OffDay.NONE, null).status()).isEqualTo("late");
    }

    @Test
    void daysWithoutPunchesSayWhy() {
        assertThat(DayCalculator.work("E", DAY, TODAY, List.of(), RULES, OffDay.WEEKEND, null).status()).isEqualTo("weekend");
        assertThat(DayCalculator.work("E", DAY, TODAY, List.of(), RULES, OffDay.HOLIDAY, null).status()).isEqualTo("holiday");
        assertThat(DayCalculator.work("E", DAY, TODAY, List.of(), RULES, OffDay.ON_LEAVE, null).status()).isEqualTo("on-leave");
        assertThat(DayCalculator.work("E", DAY, TODAY, List.of(), RULES, OffDay.NONE, null).status()).isEqualTo("absent");
        assertThat(DayCalculator.work("E", TODAY, TODAY, List.of(), RULES, OffDay.NONE, null).status()).isEqualTo("not-in-yet");
    }

    @Test
    void voidedPunchesAreIgnoredAndTheDayIsMarkedCorrected() {
        DayPunch wrong = new DayPunch(at("13:00").at(), "Front desk", false, true, null);
        DayPunch added = new DayPunch(at("17:10").at(), null, true, false, null);

        AttendanceDay day = work(List.of(at("08:58"), wrong, added));

        assertThat(day.punches()).hasSize(2);
        assertThat(day.status()).isEqualTo("present");
        assertThat(day.isCorrected()).isTrue();
    }

    @Test
    void punchesOnAWeekendStillCount() {
        assertThat(DayCalculator.work("E", DAY, TODAY, List.of(at("10:00"), at("15:00")), RULES, OffDay.WEEKEND, null).status()).isEqualTo("late");
    }

    private static DayPunch fromHome(String time) {
        return new DayPunch(OffsetDateTime.of(DAY, LocalTime.parse(time), ZoneOffset.ofHours(5)), "Home", false, false, "home");
    }

    @Test
    void aHomeDayCountsWhileItWaitsForTheManager() {
        AttendanceDay day = DayCalculator.work("E", DAY, TODAY, List.of(fromHome("08:58"), fromHome("17:05")), RULES, OffDay.NONE, "pending");

        assertThat(day.status()).isEqualTo("present");
        assertThat(day.workedMinutes()).isEqualTo(487);
        assertThat(day.workMode()).isEqualTo("home");
        assertThat(day.homeStatus()).isEqualTo("pending");
    }

    @Test
    void aDeclinedHomeDayIsAnAbsenceButKeepsItsPunches() {
        AttendanceDay day = DayCalculator.work("E", DAY, TODAY, List.of(fromHome("08:58"), fromHome("17:05")), RULES, OffDay.NONE, "rejected");

        assertThat(day.status()).isEqualTo("absent");
        assertThat(day.workedMinutes()).isZero();
        assertThat(day.punches()).hasSize(2);
        assertThat(day.homeStatus()).isEqualTo("rejected");
    }

    @Test
    void anOfficeDayIgnoresAnyHomeDecision() {
        DayPunch office = new DayPunch(OffsetDateTime.of(DAY, LocalTime.of(8, 58), ZoneOffset.ofHours(5)), "Malé office", false, false, "office");

        AttendanceDay day = DayCalculator.work("E", DAY, TODAY, List.of(office, at("17:00")), RULES, OffDay.NONE, "rejected");

        assertThat(day.status()).isEqualTo("present");
        assertThat(day.workMode()).isEqualTo("office");
        assertThat(day.homeStatus()).isNull();
    }
}
