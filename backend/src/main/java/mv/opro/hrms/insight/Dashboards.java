package mv.opro.hrms.insight;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.YearMonth;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.IntStream;
import mv.opro.hrms.attendance.AttendanceDay;
import mv.opro.hrms.attendance.AttendanceService;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.hr.Quotas;
import mv.opro.hrms.insight.Facts.Paper;
import mv.opro.hrms.insight.Facts.Person;
import mv.opro.hrms.insight.Facts.Share;
import mv.opro.hrms.leave.LeaveRequest;
import mv.opro.hrms.leave.LeaveService;
import mv.opro.hrms.performance.Appraisal;
import mv.opro.hrms.performance.AppraisalCycle;
import mv.opro.hrms.performance.Performance;
import org.springframework.stereotype.Service;

// The executive dashboard, counted here so the browser gets the figures it shows and nobody's record besides.
// Not read only: reading balances opens a leave year nobody has opened yet.
@Service
class Dashboards {

    private static final Set<String> IN_TODAY = Set.of("present", "late", "half-day", "incomplete");
    private static final int TREND_MONTHS = 6;
    private static final int PROBATION_WINDOW_DAYS = 30;
    private static final int HIGH_RATING = 4;

    record Workforce(int total, int joiners, int leavers, int growthPercent, int attritionPercent, int retentionPercent) {}

    record Presence(int present, int late, int notInYet, int absent, int onLeave, int fromHome, int atResort) {}

    record Mix(List<Share> origin, List<Share> gender, List<Share> employmentType, List<Share> age, List<Share> department, List<Share> nationality) {}

    record MonthAttendance(String month, int attendancePercent, int lateCount, int onTimePercent) {}

    record SickMonth(String month, BigDecimal days) {}

    record LeaveFigures(int pending, int annualUsedPercent, List<SickMonth> sickByMonth) {}

    record PaperFigures(String kind, String label, int expired, int expiring) {}

    record Compliance(List<PaperFigures> papers, int quotaUsed, int quotaSlots, List<String> quotasFull, int missingVisa) {}

    // On is the day it falls this year: a birthday, an anniversary, or when probation or a contract ends.
    record Event(String id, String fullName, LocalDate on, Integer years) {}

    record Events(List<Event> birthdays, List<Event> anniversaries, List<Event> probation, List<Event> contracts) {}

    record PerformanceFigures(String cycleName, int onProbation, int due, int done, String averageRating, int highPerformers, int promotions) {}

    record Dashboard(LocalDate today, Workforce workforce, Presence presence, MonthAttendance month, Mix mix, LeaveFigures leave, Compliance compliance,
            Events events, PerformanceFigures performance) {}

    private final Facts facts;
    private final AttendanceService attendance;
    private final LeaveService leave;
    private final Quotas quotas;
    private final Performance appraisals;

    Dashboards(Facts facts, AttendanceService attendance, LeaveService leave, Quotas quotas, Performance appraisals) {
        this.facts = facts;
        this.attendance = attendance;
        this.leave = leave;
        this.quotas = quotas;
        this.appraisals = appraisals;
    }

    Dashboard build() {
        LocalDate today = facts.today();
        List<Person> people = facts.everyone();
        List<Person> active = Facts.active(people, today);
        return new Dashboard(today, workforce(people, active, today), presence(active), month(active, today), mix(active, today), leave(active, today),
                compliance(active, today), events(active, today), performance(active));
    }

    // Headcount, joiners, leavers and turnover since 1 January.
    private static Workforce workforce(List<Person> people, List<Person> active, LocalDate today) {
        LocalDate yearStart = today.withDayOfYear(1);
        List<Employee> atStart = people.stream().map(Person::employee)
                .filter(employee -> employee.getJoinedOn().isBefore(yearStart) && (employee.getLastDay() == null || !employee.getLastDay().isBefore(yearStart)))
                .toList();
        long joiners = people.stream().map(Person::employee).filter(employee -> !employee.getJoinedOn().isBefore(yearStart) && !employee.getJoinedOn().isAfter(today))
                .count();
        long leavers = people.stream().map(Person::employee)
                .filter(employee -> employee.getLastDay() != null && !employee.getLastDay().isBefore(yearStart) && employee.getLastDay().isBefore(today))
                .count();
        double averageHeadcount = (atStart.size() + active.size()) / 2.0;
        long stayed = atStart.stream().filter(employee -> employee.isActiveOn(today)).count();
        return new Workforce(active.size(), (int) joiners, (int) leavers, Facts.percentOf(active.size() - atStart.size(), atStart.size()),
                averageHeadcount > 0 ? (int) Math.round(leavers * 100 / averageHeadcount) : 0, Facts.percentOf(stayed, atStart.size()));
    }

    // Where everyone is today, from the attendance worked out for each of them.
    private Presence presence(List<Person> active) {
        List<AttendanceDay> today = active.stream().flatMap(person -> attendance.today(person.employee()).stream().findFirst().stream()).toList();
        Predicate<AttendanceDay> isIn = day -> IN_TODAY.contains(day.status()) && !day.punches().isEmpty();
        Function<Predicate<AttendanceDay>, Integer> count = test -> (int) today.stream().filter(test).count();
        return new Presence(count.apply(isIn), count.apply(day -> "late".equals(day.status())), count.apply(day -> "not-in-yet".equals(day.status())),
                count.apply(day -> "absent".equals(day.status())),
                count.apply(day -> "on-leave".equals(day.status())), count.apply(isIn.and(day -> "home".equals(day.workMode()))),
                count.apply(isIn.and(day -> "resort".equals(day.workMode()))));
    }

    private MonthAttendance month(List<Person> active, LocalDate today) {
        YearMonth month = YearMonth.from(today);
        List<AttendanceDay> days = active.stream().flatMap(person -> attendance.month(person.employee(), month).stream())
                .filter(day -> !day.date().isAfter(today)).toList();
        MonthSummary summary = MonthSummary.of(days);
        return new MonthAttendance(month.toString(), summary.attendancePercent(), summary.lateCount(), summary.onTimePercent());
    }

    private static Mix mix(List<Person> active, LocalDate today) {
        List<Employee> staff = active.stream().map(Person::employee).toList();
        return new Mix(Facts.shares(active, person -> person.isExpatriate() ? "Expatriates" : "Maldivians"), Facts.shares(staff, Facts::genderLabel),
                Facts.shares(staff, Employee::getEmploymentType), Facts.shares(staff, employee -> Facts.ageBand(employee.getDateOfBirth(), today)),
                Facts.shares(staff, Employee::getDepartment), Facts.shares(staff, Employee::getNationality));
    }

    // Leave waiting, annual leave used this leave year, and sick days approved by month for the last six months.
    private LeaveFigures leave(List<Person> active, LocalDate today) {
        List<LeaveService.Balance> annual = active.stream().flatMap(person -> leave.balancesOf(person.id()).stream())
                .filter(balance -> "annual".equals(balance.type())).toList();
        BigDecimal entitled = annual.stream().map(LeaveService.Balance::entitled).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal taken = annual.stream().map(LeaveService.Balance::taken).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<LeaveRequest> requests = leave.allRequests(null);
        YearMonth thisMonth = YearMonth.from(today);
        List<SickMonth> sick = IntStream.range(0, TREND_MONTHS).mapToObj(index -> thisMonth.minusMonths(TREND_MONTHS - 1 - index))
                .map(month -> new SickMonth(month.toString(), requests.stream()
                        .filter(request -> "sick".equals(request.getType()) && "approved".equals(request.getStatus())
                                && YearMonth.from(request.getFromDate()).equals(month))
                        .map(LeaveRequest::getDays).reduce(BigDecimal.ZERO, BigDecimal::add)))
                .toList();
        int pending = (int) requests.stream().filter(request -> "pending".equals(request.getStatus())).count();
        return new LeaveFigures(pending, entitled.signum() > 0 ? taken.multiply(BigDecimal.valueOf(100)).divide(entitled, 0, RoundingMode.HALF_UP).intValue() : 0,
                sick);
    }

    // For each kind of paper, how many have run out and how many run out within 60 days.
    private Compliance compliance(List<Person> active, LocalDate today) {
        List<PaperFigures> papers = Arrays.stream(Paper.values()).map(paper -> {
            List<Long> left = active.stream().map(paper::of).filter(Objects::nonNull).map(date -> Facts.daysUntil(date, today)).toList();
            return new PaperFigures(paper.name().toLowerCase(), paper.label, (int) left.stream().filter(days -> days < 0).count(),
                    (int) left.stream().filter(days -> days >= 0 && days <= Facts.EXPIRY_WARNING_DAYS).count());
        }).toList();
        List<Quotas.QuotaResponse> approvals = quotas.list();
        return new Compliance(papers, approvals.stream().mapToInt(Quotas.QuotaResponse::used).sum(), approvals.stream().mapToInt(Quotas.QuotaResponse::slots).sum(),
                approvals.stream().filter(quota -> quota.used() >= quota.slots()).map(Quotas.QuotaResponse::jobCategory).toList(),
                (int) active.stream().filter(person -> person.isExpatriate() && (person.visa() == null || person.visa().getVisaExpiry() == null)).count());
    }

    // This month's birthdays and work anniversaries, probation ending within 30 days, contracts within 60.
    private static Events events(List<Person> active, LocalDate today) {
        Function<LocalDate, LocalDate> thisYear = date -> MonthDay.from(date).atYear(today.getYear());
        Comparator<Event> byDay = Comparator.comparing(Event::on);
        List<Event> birthdays = active.stream().map(Person::employee)
                .filter(employee -> employee.getDateOfBirth() != null && employee.getDateOfBirth().getMonth() == today.getMonth())
                .map(employee -> new Event(employee.getId(), employee.getFullName(), thisYear.apply(employee.getDateOfBirth()), null)).sorted(byDay).toList();
        List<Event> anniversaries = active.stream().map(Person::employee)
                .filter(employee -> employee.getJoinedOn().getMonth() == today.getMonth() && employee.getJoinedOn().getYear() < today.getYear())
                .map(employee -> new Event(employee.getId(), employee.getFullName(), thisYear.apply(employee.getJoinedOn()),
                        today.getYear() - employee.getJoinedOn().getYear()))
                .sorted(byDay).toList();
        return new Events(birthdays, anniversaries, within(active, Employee::getProbationEndsOn, today, PROBATION_WINDOW_DAYS),
                within(active, Employee::getContractEndsOn, today, Facts.EXPIRY_WARNING_DAYS));
    }

    private static List<Event> within(List<Person> active, Function<Employee, LocalDate> dateOf, LocalDate today, int days) {
        return active.stream().map(Person::employee)
                .filter(employee -> dateOf.apply(employee) != null && !dateOf.apply(employee).isBefore(today) && !dateOf.apply(employee).isAfter(today.plusDays(days)))
                .map(employee -> new Event(employee.getId(), employee.getFullName(), dateOf.apply(employee), null)).toList();
    }

    // On probation, and how far the latest appraisal cycle has got. Everyone with an HOD is appraised; super admins have none.
    private PerformanceFigures performance(List<Person> active) {
        int onProbation = (int) active.stream().filter(person -> person.employee().getProbationEndsOn() != null).count();
        List<String> appraised = active.stream().filter(person -> person.employee().getManagerId() != null).map(Person::id).toList();
        AppraisalCycle cycle = appraisals.latestCycle().orElse(null);
        Map<String, Appraisal> rated = cycle == null ? Map.of() : appraisals.appraisalsIn(cycle.getId());
        List<Appraisal> done = appraised.stream().map(rated::get).filter(Objects::nonNull).toList();
        String average = done.isEmpty() ? null
                : BigDecimal.valueOf(done.stream().mapToInt(Appraisal::getRating).sum()).divide(BigDecimal.valueOf(done.size()), 1, RoundingMode.HALF_UP).toPlainString();
        return new PerformanceFigures(cycle == null ? null : cycle.getName(), onProbation, appraised.size(), done.size(), average,
                (int) done.stream().filter(appraisal -> appraisal.getRating() >= HIGH_RATING).count(),
                (int) done.stream().filter(Appraisal::recommendsPromotion).count());
    }
}
