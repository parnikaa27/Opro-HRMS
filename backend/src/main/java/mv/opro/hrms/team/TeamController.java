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
import java.util.stream.Stream;
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
import mv.opro.hrms.attendance.OvertimeResponse;
import mv.opro.hrms.attendance.Overtimes;
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
import io.swagger.v3.oas.annotations.tags.Tag;

// The HOD's view of their direct reports (/api/team), and the super admin's view of everyone (/api/company),
// where they can step in on any decision when an HOD is away. Every endpoint goes through TeamAccess first.
@Tag(name = "Team and company", description = "/api/team for an HOD's direct reports, /api/company for a super admin's view of everyone, with the same shapes. Both decide leave, punch fixes, home days, comp off and overtime, never their own.")
@RestController
class TeamController {

    private static final int MAX_NOTE = 300;
    private static final String COMPANY = "company";

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
    private final Overtimes overtimes;
    private final Photos photos;

    TeamController(TeamAccess access, CurrentUser currentUser, People people, VisaRepository visas, AttendanceService attendance, LeaveService leave,
            Corrections corrections, HomeDays homeDays, CompOffs compOffs, Overtimes overtimes, Photos photos) {
        this.access = access;
        this.currentUser = currentUser;
        this.people = people;
        this.visas = visas;
        this.attendance = attendance;
        this.leave = leave;
        this.corrections = corrections;
        this.homeDays = homeDays;
        this.compOffs = compOffs;
        this.overtimes = overtimes;
        this.photos = photos;
    }

    // An HOD's direct reports, or everyone for a super admin.
    private List<Employee> inScope(String scope) {
        Employee me = currentUser.get();
        return COMPANY.equals(scope) ? access.everyoneFor(me) : access.reportsOf(me);
    }

    // Who the reader may decide for: never themselves.
    private Map<String, String> decidableIn(String scope, Employee me) {
        Map<String, String> names = namesOf(inScope(scope));
        names.remove(me.getId());
        return names;
    }

    @GetMapping("/api/{scope:team|company}")
    List<TeamMemberResponse> people(@PathVariable String scope) {
        return inScope(scope).stream()
                .map(employee -> new TeamMemberResponse(profile(employee), attendance.today(employee).stream().findFirst().orElse(null)))
                .toList();
    }

    @GetMapping("/api/{scope:team|company}/{id}")
    TeamMemberDetail member(@PathVariable String scope, @PathVariable String id) {
        Employee employee = inScope(scope).stream()
                .filter(found -> found.getId().equals(id))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, COMPANY.equals(scope) ? "Employee not found" : "Not one of your reports"));
        return new TeamMemberDetail(profile(employee), leave.balancesOf(employee.getId()));
    }

    @GetMapping("/api/{scope:team|company}/attendance")
    List<AttendanceDay> attendance(@PathVariable String scope, @RequestParam String month) {
        YearMonth chosen = parse(month);
        return inScope(scope).stream()
                .flatMap(employee -> attendance.month(employee, chosen).stream().map(day -> day.named(employee.getFullName())))
                .toList();
    }

    @GetMapping("/api/{scope:team|company}/leave-requests")
    List<LeaveRequestResponse> leaveRequests(@PathVariable String scope, @RequestParam(required = false) String status) {
        Map<String, String> names = namesOf(inScope(scope));
        List<LeaveRequest> requests = leave.requestsOf(names.keySet(), status);
        Map<String, String> deciders = people.namesOf(requests.stream()
                .flatMap(request -> Stream.of(request.getDecidedBy(), request.getHodApprovedBy())).filter(Objects::nonNull).collect(Collectors.toSet()));
        return requests.stream().map(request -> LeaveRequestResponse.of(request, names.get(request.getEmployeeId()), deciders)).toList();
    }

    @PostMapping("/api/{scope:team|company}/leave-requests/{id}/decision")
    LeaveRequestResponse decideLeave(@PathVariable String scope, @PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = currentUser.get();
        Map<String, String> names = decidableIn(scope, me);
        LeaveRequest decided = leave.decide(me, id, names.keySet(), new LeaveService.Decision(body.decision(), body.note()));
        return LeaveRequestResponse.of(decided, names.get(decided.getEmployeeId()), Map.of(me.getId(), me.getFullName()));
    }

    @GetMapping("/api/{scope:team|company}/corrections")
    List<CorrectionResponse> corrections(@PathVariable String scope, @RequestParam(required = false) String status) {
        Map<String, String> names = namesOf(inScope(scope));
        return corrections.of(names.keySet(), status).stream().map(request -> CorrectionResponse.of(request, names.get(request.getEmployeeId()))).toList();
    }

    @PostMapping("/api/{scope:team|company}/corrections/{id}/decision")
    CorrectionResponse decideCorrection(@PathVariable String scope, @PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = currentUser.get();
        Map<String, String> names = decidableIn(scope, me);
        CorrectionRequest decided = corrections.decide(me, id, names.keySet(), new Corrections.Decision(body.decision(), body.note()));
        return CorrectionResponse.of(decided, names.get(decided.getEmployeeId()));
    }

    @GetMapping("/api/{scope:team|company}/home-days")
    List<HomeDayResponse> homeDays(@PathVariable String scope, @RequestParam(required = false) String status) {
        Map<String, String> names = namesOf(inScope(scope));
        return homeDays.of(names.keySet(), status).stream().map(day -> HomeDayResponse.of(day, names)).toList();
    }

    @PostMapping("/api/{scope:team|company}/home-days/{id}/decision")
    HomeDayResponse decideHomeDay(@PathVariable String scope, @PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = currentUser.get();
        Map<String, String> names = decidableIn(scope, me);
        HomeDay decided = homeDays.decide(me, id, Set.copyOf(names.keySet()), new Corrections.Decision(body.decision(), body.note()));
        names.put(me.getId(), me.getFullName());
        return HomeDayResponse.of(decided, names);
    }

    @GetMapping("/api/{scope:team|company}/comp-offs")
    List<CompOffResponse> compOffs(@PathVariable String scope, @RequestParam(required = false) String status) {
        Map<String, String> names = namesOf(inScope(scope));
        return compOffs.of(names.keySet(), status).stream().map(claim -> CompOffResponse.of(claim, names)).toList();
    }

    @PostMapping("/api/{scope:team|company}/comp-offs/{id}/decision")
    CompOffResponse decideCompOff(@PathVariable String scope, @PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = currentUser.get();
        Map<String, String> names = decidableIn(scope, me);
        CompOffs.Claim decided = compOffs.decide(me, id, Set.copyOf(names.keySet()), new Corrections.Decision(body.decision(), body.note()));
        names.put(me.getId(), me.getFullName());
        return CompOffResponse.of(decided, names);
    }

    @GetMapping("/api/{scope:team|company}/overtime")
    List<OvertimeResponse> overtime(@PathVariable String scope, @RequestParam(required = false) String status) {
        Map<String, String> names = namesOf(inScope(scope));
        return overtimes.of(names.keySet(), status).stream().map(claim -> OvertimeResponse.of(claim, names)).toList();
    }

    @PostMapping("/api/{scope:team|company}/overtime/{id}/decision")
    OvertimeResponse decideOvertime(@PathVariable String scope, @PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = currentUser.get();
        Map<String, String> names = decidableIn(scope, me);
        Overtimes.Claim decided = overtimes.decide(me, id, Set.copyOf(names.keySet()), new Corrections.Decision(body.decision(), body.note()));
        names.put(me.getId(), me.getFullName());
        return OvertimeResponse.of(decided, names);
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
