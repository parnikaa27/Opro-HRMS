package mv.opro.hrms.insight;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.time.YearMonth;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.attendance.AttendanceService;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.insight.Facts.Paper;
import mv.opro.hrms.insight.Facts.Person;
import mv.opro.hrms.leave.LeaveService;
import mv.opro.hrms.leave.LeaveType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

// Each report as the rows shown on screen. The browser saves the same rows as CSV, Excel or PDF.
// Not read only: reading balances opens a leave year nobody has opened yet.
@Service
class Reports {

    private static final int MINUTES_PER_HOUR = 60;
    private static final String NO_DATE = "";

    record ReportTable(String title, String fileName, List<String> columns, List<List<Object>> rows) {}

    enum MixBy {
        DEPARTMENT("department", "Department"), NATIONALITY("nationality", "Nationality"), GENDER("gender", "Gender"), AGE("age", "Age"),
        EMPLOYMENT_TYPE("employmentType", "Employment type");

        final String value;
        final String label;

        MixBy(String value, String label) {
            this.value = value;
            this.label = label;
        }

        static MixBy from(String value) {
            return Arrays.stream(values()).filter(by -> by.value.equals(value)).findFirst()
                    .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Pick department, nationality, gender, age or employment type."));
        }

        String labelOf(Employee employee, LocalDate today) {
            return switch (this) {
                case DEPARTMENT -> employee.getDepartment();
                case NATIONALITY -> employee.getNationality();
                case GENDER -> Facts.genderLabel(employee);
                case AGE -> Facts.ageBand(employee.getDateOfBirth(), today);
                case EMPLOYMENT_TYPE -> employee.getEmploymentType();
            };
        }
    }

    private final Facts facts;
    private final AttendanceService attendance;
    private final LeaveService leave;

    Reports(Facts facts, AttendanceService attendance, LeaveService leave) {
        this.facts = facts;
        this.attendance = attendance;
        this.leave = leave;
    }

    ReportTable build(String kind, Integer year, YearMonth month, String by) {
        LocalDate today = facts.today();
        List<Person> people = facts.everyone();
        List<Person> active = Facts.active(people, today);
        int chosenYear = year == null ? today.getYear() : year;
        YearMonth chosenMonth = month == null ? YearMonth.from(today) : month;
        return switch (kind) {
            case "headcount" -> headcount(active, today);
            case "movement" -> movement(people, chosenYear);
            case "mix" -> mix(active, MixBy.from(by == null ? "department" : by), today);
            case "balances" -> balances(active, today);
            case "leave" -> leaveTaken(people, chosenYear);
            case "attendance" -> attendance(active, chosenMonth, today);
            case "papers" -> papers(active, today);
            default -> throw new ApiException(HttpStatus.NOT_FOUND, "There's no report called " + kind + ".");
        };
    }

    private static ReportTable headcount(List<Person> active, LocalDate today) {
        return new ReportTable("Headcount", "headcount-" + today,
                List.of("Name", "Employee ID", "Department", "Designation", "Nationality", "Gender", "Age", "Employment", "Joined"),
                active.stream().map(Person::employee).map(employee -> row(employee.getFullName(), employee.getId(), employee.getDepartment(),
                        employee.getDesignation(), employee.getNationality(), Facts.genderLabel(employee),
                        employee.getDateOfBirth() == null ? NO_DATE : Period.between(employee.getDateOfBirth(), today).getYears(),
                        employee.getEmploymentType(), employee.getJoinedOn().toString())).toList());
    }

    private static ReportTable movement(List<Person> people, int year) {
        Stream<List<Object>> joined = people.stream().map(Person::employee).filter(employee -> employee.getJoinedOn().getYear() == year)
                .map(employee -> row(employee.getFullName(), employee.getDepartment(), "Joined", employee.getJoinedOn().toString()));
        Stream<List<Object>> left = people.stream().map(Person::employee).filter(employee -> employee.getLastDay() != null && employee.getLastDay().getYear() == year)
                .map(employee -> row(employee.getFullName(), employee.getDepartment(), "Left", employee.getLastDay().toString()));
        return new ReportTable("Joiners and leavers, " + year, "joiners-and-leavers-" + year, List.of("Name", "Department", "Change", "Date"),
                Stream.concat(joined, left).sorted(Comparator.comparing(row -> String.valueOf(row.get(3)))).toList());
    }

    private static ReportTable mix(List<Person> active, MixBy by, LocalDate today) {
        return new ReportTable("Workforce by " + by.label.toLowerCase(), "workforce-by-" + by.value + "-" + today, List.of(by.label, "People", "Share"),
                Facts.shares(active.stream().map(Person::employee).toList(), employee -> by.labelOf(employee, today)).stream()
                        .map(share -> row(share.label(), share.count(), share.percent() + "%")).toList());
    }

    private ReportTable balances(List<Person> active, LocalDate today) {
        Function<String, String> typeName = typeNames();
        return new ReportTable("Leave balances, " + today.getYear(), "leave-balances-" + today.getYear(),
                List.of("Name", "Leave type", "Entitled", "Taken", "Waiting", "Left"),
                active.stream().flatMap(person -> leave.balancesOf(person.id()).stream()
                        .map(balance -> row(person.fullName(), typeName.apply(balance.type()), balance.entitled(), balance.taken(), balance.pending(),
                                balance.entitled().subtract(balance.taken()).subtract(balance.pending()))))
                        .toList());
    }

    private ReportTable leaveTaken(List<Person> people, int year) {
        Map<String, String> names = people.stream().collect(Collectors.toMap(Person::id, Person::fullName));
        Function<String, String> typeName = typeNames();
        return new ReportTable("Leave taken, " + year, "leave-" + year, List.of("Name", "Leave type", "From", "To", "Days", "Status"),
                leave.allRequests(null).stream().filter(request -> request.getFromDate().getYear() == year)
                        .sorted(Comparator.comparing(request -> request.getFromDate()))
                        .map(request -> row(names.getOrDefault(request.getEmployeeId(), request.getEmployeeId()), typeName.apply(request.getType()),
                                request.getFromDate().toString(), request.getToDate().toString(), request.getDays(), request.getStatus()))
                        .toList());
    }

    private ReportTable attendance(List<Person> active, YearMonth month, LocalDate today) {
        return new ReportTable("Attendance, " + month, "attendance-" + month, List.of("Name", "Days present", "Working days", "Late", "Missed", "Hours", "On time"),
                active.stream().map(person -> {
                    MonthSummary summary = MonthSummary.of(attendance.month(person.employee(), month).stream().filter(day -> !day.date().isAfter(today)).toList());
                    return row(person.fullName(), summary.present(), summary.workingDays(), summary.lateCount(), summary.missed(), hours(summary.workedMinutes()),
                            summary.onTimePercent() + "%");
                }).toList());
    }

    // Every expatriate's papers, soonest to run out first.
    private static ReportTable papers(List<Person> active, LocalDate today) {
        List<String> columns = Stream.concat(Stream.concat(Stream.of("Name"), Arrays.stream(Paper.values()).map(paper -> paper.label)), Stream.of("Soonest, days")).toList();
        record Soonest(Person person, Long days) {}
        return new ReportTable("Visa and permit expiry", "visa-and-permit-expiry-" + today, columns,
                active.stream().filter(Person::isExpatriate)
                        .map(person -> new Soonest(person, Arrays.stream(Paper.values()).map(paper -> paper.of(person)).filter(Objects::nonNull)
                                .map(date -> Facts.daysUntil(date, today)).min(Long::compare).orElse(null)))
                        .sorted(Comparator.comparing(Soonest::days, Comparator.nullsLast(Comparator.naturalOrder())))
                        .map(soonest -> {
                            List<Object> cells = Stream.concat(Stream.of((Object) soonest.person().fullName()), Arrays.stream(Paper.values())
                                    .map(paper -> paper.of(soonest.person())).map(date -> (Object) (date == null ? "None" : date.toString()))).collect(Collectors.toList());
                            cells.add(soonest.days() == null ? "No papers" : soonest.days());
                            return cells;
                        }).toList());
    }

    private Function<String, String> typeNames() {
        Map<String, String> names = leave.types().stream().collect(Collectors.toMap(LeaveType::getCode, LeaveType::getName));
        return code -> names.getOrDefault(code, code);
    }

    // "08h 54m", as the attendance log shows hours.
    private static String hours(long minutes) {
        return String.format("%02dh %02dm", minutes / MINUTES_PER_HOUR, minutes % MINUTES_PER_HOUR);
    }

    private static List<Object> row(Object... cells) {
        return List.of(cells);
    }
}
