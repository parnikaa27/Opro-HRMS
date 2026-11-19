package mv.opro.hrms.insight;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import mv.opro.hrms.attendance.AttendanceDay;
import mv.opro.hrms.attendance.AttendanceService;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.employee.Visa;
import mv.opro.hrms.employee.VisaRepository;
import mv.opro.hrms.hr.Quotas;
import mv.opro.hrms.leave.LeaveService;
import mv.opro.hrms.performance.CycleResponse;
import mv.opro.hrms.performance.Performance;
import mv.opro.hrms.record.MedicalInsurance;
import mv.opro.hrms.record.Records;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// The facts behind the executive dashboard and the reports, for HR and super admins only. The pages count and
// group them; this only gathers them, so every number on screen traces back to a record.
@Tag(name = "Insights", description = "Everyone (past staff included), leave, balances, quota use and a month of attendance, for the dashboard and reports. HR and super admins only.")
@RestController
class InsightController {

    record Person(String id, String fullName, String department, String designation, String nationality, String gender, LocalDate dateOfBirth,
            LocalDate joinedOn, LocalDate lastDay, String employmentType, String jobCategory, String managerId, AttendanceDay today, LocalDate visaExpiry,
            LocalDate passportExpiry, LocalDate employmentApprovalExpiry, LocalDate medicalDueOn, LocalDate insuranceExpiry, LocalDate probationEndsOn,
            LocalDate contractEndsOn) {}

    record Leave(String employeeId, String type, LocalDate from, LocalDate to, BigDecimal days, String status, LocalDate appliedOn) {}

    record Balance(String employeeId, String type, BigDecimal entitled, BigDecimal taken, BigDecimal pending) {}

    // An appraisal in the latest cycle.
    record Rated(String employeeId, int rating, boolean recommendsPromotion, BigDecimal incrementPercent) {}

    record Insights(LocalDate today, List<Person> people, List<Leave> leave, List<Balance> balances, List<Quotas.QuotaResponse> quotas,
            CycleResponse cycle, List<Rated> appraisals) {}

    private final CurrentUser currentUser;
    private final EmployeeRepository employees;
    private final VisaRepository visas;
    private final Records records;
    private final AttendanceService attendance;
    private final LeaveService leave;
    private final Quotas quotas;
    private final Performance performance;
    private final Clock clock;

    InsightController(CurrentUser currentUser, EmployeeRepository employees, VisaRepository visas, Records records, AttendanceService attendance,
            LeaveService leave, Quotas quotas, Performance performance, Clock clock) {
        this.currentUser = currentUser;
        this.employees = employees;
        this.visas = visas;
        this.records = records;
        this.attendance = attendance;
        this.leave = leave;
        this.quotas = quotas;
        this.performance = performance;
        this.clock = clock;
    }

    // Last year and this year: enough for trends and for joiners and leavers this year.
    @GetMapping("/api/insights")
    Insights insights() {
        allowed();
        LocalDate today = LocalDate.now(clock);
        Map<String, Visa> visaOf = visas.findAll().stream().collect(Collectors.toMap(Visa::getEmployeeId, Function.identity()));
        Map<String, LocalDate> insuranceOf = records.allInsurance().stream()
                .collect(Collectors.toMap(MedicalInsurance::getEmployeeId, MedicalInsurance::getExpiresOn));
        List<Employee> everyone = employees.findAll().stream().sorted(Comparator.comparing(Employee::getFullName)).toList();
        List<Employee> active = everyone.stream().filter(employee -> employee.isActiveOn(today)).toList();
        int since = today.getYear() - 1;
        return new Insights(today,
                everyone.stream().map(employee -> person(employee, today, visaOf.get(employee.getId()), insuranceOf.get(employee.getId()))).toList(),
                leave.allRequests(null).stream()
                        .filter(request -> request.getFromDate().getYear() >= since)
                        .map(request -> new Leave(request.getEmployeeId(), request.getType(), request.getFromDate(), request.getToDate(), request.getDays(),
                                request.getStatus(), request.getAppliedOn()))
                        .toList(),
                active.stream().flatMap(employee -> leave.balancesOf(employee.getId()).stream()
                        .map(balance -> new Balance(employee.getId(), balance.type(), balance.entitled(), balance.taken(), balance.pending()))).toList(),
                quotas.list(),
                performance.latestCycle().map(CycleResponse::of).orElse(null),
                performance.latestCycle().map(cycle -> performance.appraisalsIn(cycle.getId()).values().stream()
                        .map(appraisal -> new Rated(appraisal.getEmployeeId(), appraisal.getRating(), appraisal.recommendsPromotion(), appraisal.getIncrementPercent()))
                        .toList()).orElse(List.of()));
    }

    // Everyone at Opro that month, worked out the same way as their own attendance page.
    @GetMapping("/api/insights/attendance")
    List<AttendanceDay> attendance(@RequestParam String month) {
        allowed();
        YearMonth chosen;
        try {
            chosen = YearMonth.parse(month);
        } catch (DateTimeParseException error) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Month must look like 2026-11");
        }
        LocalDate today = LocalDate.now(clock);
        return employees.findAll().stream()
                .filter(employee -> employee.isActiveOn(today))
                .flatMap(employee -> attendance.month(employee, chosen).stream().map(day -> day.named(employee.getFullName())))
                .toList();
    }

    private void allowed() {
        Employee me = currentUser.get();
        if (!me.isHr() && !me.isSuperAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HR and super admins only");
        }
    }

    private Person person(Employee employee, LocalDate today, Visa visa, LocalDate insuranceExpiry) {
        Optional<Visa> papers = Optional.ofNullable(visa);
        AttendanceDay now = employee.isActiveOn(today) ? attendance.today(employee).stream().findFirst().orElse(null) : null;
        return new Person(employee.getId(), employee.getFullName(), employee.getDepartment(), employee.getDesignation(), employee.getNationality(),
                employee.getGender(), employee.getDateOfBirth(), employee.getJoinedOn(), employee.getLastDay(), employee.getEmploymentType(),
                employee.getJobCategory(), employee.getManagerId(), now, papers.map(Visa::getVisaExpiry).orElse(null),
                papers.map(Visa::getPassportExpiry).orElse(null), papers.map(Visa::getEmploymentApprovalExpiry).orElse(null),
                papers.map(Visa::getMedicalDueOn).orElse(null), insuranceExpiry, employee.getProbationEndsOn(), employee.getContractEndsOn());
    }
}
