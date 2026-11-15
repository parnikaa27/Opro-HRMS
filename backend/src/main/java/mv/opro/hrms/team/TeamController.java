package mv.opro.hrms.team;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import mv.opro.hrms.attendance.AttendanceDay;
import mv.opro.hrms.attendance.AttendanceService;
import mv.opro.hrms.attendance.CompOffResponse;
import mv.opro.hrms.attendance.CompOffs;
import mv.opro.hrms.attendance.CorrectionRequest;
import mv.opro.hrms.attendance.CorrectionResponse;
import mv.opro.hrms.attendance.Corrections;
import mv.opro.hrms.attendance.HomeDay;
import mv.opro.hrms.attendance.HomeDayResponse;
import mv.opro.hrms.attendance.HomeDays;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeResponse;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.employee.Photos;
import mv.opro.hrms.employee.VisaRepository;
import mv.opro.hrms.leave.LeaveRequest;
import mv.opro.hrms.leave.LeaveRequestResponse;
import mv.opro.hrms.leave.LeaveService;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// The manager's view of their direct reports. Every endpoint goes through TeamAccess first.
@RestController
class TeamController {

    private static final int MAX_NOTE = 300;

    record TeamMemberResponse(@JsonUnwrapped EmployeeResponse employee, AttendanceDay today) {}

    record TeamMemberDetail(@JsonUnwrapped EmployeeResponse employee, List<LeaveService.Balance> leaveBalances) {}

    record DecisionBody(@NotNull @Pattern(regexp = "approved|rejected") String decision, @Size(max = MAX_NOTE) String note) {}

    private final TeamAccess access;
    private final CurrentUser currentUser;
    private final People people;
    private final VisaRepository visas;
    private final AttendanceService attendance;
    private final LeaveService leave;
    private final Corrections corrections;
    private final HomeDays homeDays;
    private final CompOffs compOffs;
    private final Photos photos;

    TeamController(TeamAccess access, CurrentUser currentUser, People people, VisaRepository visas, AttendanceService attendance, LeaveService leave,
            Corrections corrections, HomeDays homeDays, CompOffs compOffs, Photos photos) {
        this.access = access;
        this.currentUser = currentUser;
        this.people = people;
        this.visas = visas;
        this.attendance = attendance;
        this.leave = leave;
        this.corrections = corrections;
        this.homeDays = homeDays;
        this.compOffs = compOffs;
        this.photos = photos;
    }

    @GetMapping("/api/team")
    List<TeamMemberResponse> team() {
        return access.reportsOf(currentUser.get()).stream()
                .map(report -> new TeamMemberResponse(profile(report), attendance.today(report).stream().findFirst().orElse(null)))
                .toList();
    }

    @GetMapping("/api/team/{id}")
    TeamMemberDetail member(@PathVariable String id) {
        Employee report = access.report(currentUser.get(), id);
        return new TeamMemberDetail(profile(report), leave.balancesOf(report.getId()));
    }

    @GetMapping("/api/team/attendance")
    List<AttendanceDay> attendance(@RequestParam String month) {
        YearMonth chosen = parse(month);
        return access.reportsOf(currentUser.get()).stream()
                .flatMap(report -> attendance.month(report, chosen).stream().map(day -> day.named(report.getFullName())))
                .toList();
    }

    @GetMapping("/api/team/leave-requests")
    List<LeaveRequestResponse> leaveRequests(@RequestParam(required = false) String status) {
        Map<String, String> names = namesOf(access.reportsOf(currentUser.get()));
        List<LeaveRequest> requests = leave.requestsOf(names.keySet(), status);
        Map<String, String> deciders = people.namesOf(requests.stream().map(LeaveRequest::getDecidedBy).filter(Objects::nonNull).collect(Collectors.toSet()));
        return requests.stream().map(request -> LeaveRequestResponse.of(request, names.get(request.getEmployeeId()), deciders)).toList();
    }

    @PostMapping("/api/team/leave-requests/{id}/decision")
    LeaveRequestResponse decideLeave(@PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = currentUser.get();
        Map<String, String> names = namesOf(access.reportsOf(me));
        LeaveRequest decided = leave.decide(me, id, names.keySet(), new LeaveService.Decision(body.decision(), body.note()));
        return LeaveRequestResponse.of(decided, names.get(decided.getEmployeeId()), Map.of(me.getId(), me.getFullName()));
    }

    @GetMapping("/api/team/corrections")
    List<CorrectionResponse> corrections(@RequestParam(required = false) String status) {
        Map<String, String> names = namesOf(access.reportsOf(currentUser.get()));
        return corrections.of(names.keySet(), status).stream().map(request -> CorrectionResponse.of(request, names.get(request.getEmployeeId()))).toList();
    }

    @PostMapping("/api/team/corrections/{id}/decision")
    CorrectionResponse decideCorrection(@PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = currentUser.get();
        Map<String, String> names = namesOf(access.reportsOf(me));
        CorrectionRequest decided = corrections.decide(me, id, names.keySet(), new Corrections.Decision(body.decision(), body.note()));
        return CorrectionResponse.of(decided, names.get(decided.getEmployeeId()));
    }

    @GetMapping("/api/team/home-days")
    List<HomeDayResponse> homeDays(@RequestParam(required = false) String status) {
        Map<String, String> names = namesOf(access.reportsOf(currentUser.get()));
        return homeDays.of(names.keySet(), status).stream().map(day -> HomeDayResponse.of(day, names)).toList();
    }

    @PostMapping("/api/team/home-days/{id}/decision")
    HomeDayResponse decideHomeDay(@PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = currentUser.get();
        Map<String, String> names = namesOf(access.reportsOf(me));
        HomeDay decided = homeDays.decide(me, id, Set.copyOf(names.keySet()), new Corrections.Decision(body.decision(), body.note()));
        names.put(me.getId(), me.getFullName());
        return HomeDayResponse.of(decided, names);
    }

    @GetMapping("/api/team/comp-offs")
    List<CompOffResponse> compOffs(@RequestParam(required = false) String status) {
        Map<String, String> names = namesOf(access.reportsOf(currentUser.get()));
        return compOffs.of(names.keySet(), status).stream().map(claim -> CompOffResponse.of(claim, names)).toList();
    }

    @PostMapping("/api/team/comp-offs/{id}/decision")
    CompOffResponse decideCompOff(@PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = currentUser.get();
        Map<String, String> names = namesOf(access.reportsOf(me));
        CompOffs.Claim decided = compOffs.decide(me, id, Set.copyOf(names.keySet()), new Corrections.Decision(body.decision(), body.note()));
        names.put(me.getId(), me.getFullName());
        return CompOffResponse.of(decided, names);
    }

    private EmployeeResponse profile(Employee employee) {
        return EmployeeResponse.of(employee, people.rolesOf(employee), visas.findById(employee.getId()).orElse(null), photos.urlOf(employee.getId()).orElse(null));
    }

    private static Map<String, String> namesOf(List<Employee> employees) {
        return employees.stream().collect(Collectors.toMap(Employee::getId, Employee::getFullName, (first, second) -> first, LinkedHashMap::new));
    }

    private static YearMonth parse(String month) {
        try {
            return YearMonth.parse(month);
        } catch (DateTimeParseException error) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Month must look like 2026-11");
        }
    }
}
