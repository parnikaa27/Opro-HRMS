package mv.opro.hrms.approval;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;
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
import mv.opro.hrms.employee.People;
import mv.opro.hrms.hr.HrAccess;
import mv.opro.hrms.leave.LeaveRequest;
import mv.opro.hrms.leave.LeaveRequestResponse;
import mv.opro.hrms.leave.LeaveService;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "HR approvals", description = "The HR step after the HOD, for requests HR has asked to approve too: what waits for HR, deciding it, and which kinds need it. HR only, never for their own requests.")
@RestController
class HrApprovalController {

    private static final int MAX_NOTE = 300;

    record Waiting(List<LeaveRequestResponse> leave, List<CorrectionResponse> corrections, List<HomeDayResponse> homeDays, List<CompOffResponse> compOffs,
            List<OvertimeResponse> overtime) {}

    record DecisionBody(@NotNull @Pattern(regexp = "approved|rejected") String decision, @Size(max = MAX_NOTE) String note) {}

    record RulesBody(@NotNull Boolean punchFixes, @NotNull Boolean homeDays, @NotNull Boolean compOff, @NotNull Boolean overtime) {}

    private final HrAccess access;
    private final CurrentUser currentUser;
    private final People people;
    private final ApprovalSteps steps;
    private final LeaveService leave;
    private final Corrections corrections;
    private final HomeDays homeDays;
    private final CompOffs compOffs;
    private final Overtimes overtimes;

    HrApprovalController(HrAccess access, CurrentUser currentUser, People people, ApprovalSteps steps, LeaveService leave, Corrections corrections,
            HomeDays homeDays, CompOffs compOffs, Overtimes overtimes) {
        this.access = access;
        this.currentUser = currentUser;
        this.people = people;
        this.steps = steps;
        this.leave = leave;
        this.corrections = corrections;
        this.homeDays = homeDays;
        this.compOffs = compOffs;
        this.overtimes = overtimes;
    }

    // Everything waiting for HR but the reader's own, oldest first.
    @GetMapping("/api/hr/approvals")
    Waiting waiting() {
        Employee me = access.require(currentUser.get());
        List<LeaveRequest> leaveWaiting = leave.waitingForHr().stream().filter(request -> !request.getEmployeeId().equals(me.getId())).toList();
        List<CorrectionRequest> fixes = corrections.waitingForHr().stream().filter(request -> !request.getEmployeeId().equals(me.getId())).toList();
        List<HomeDay> days = homeDays.waitingForHr().stream().filter(day -> !day.getEmployeeId().equals(me.getId())).toList();
        List<CompOffs.Claim> dayOffs = compOffs.waitingForHr().stream().filter(claim -> !claim.claim().getEmployeeId().equals(me.getId())).toList();
        List<Overtimes.Claim> late = overtimes.waitingForHr().stream().filter(claim -> !claim.claim().getEmployeeId().equals(me.getId())).toList();
        Map<String, String> names = people.namesOf(Stream.of(
                leaveWaiting.stream().flatMap(request -> Stream.of(request.getEmployeeId(), request.getHodApprovedBy())),
                fixes.stream().flatMap(request -> Stream.of(request.getEmployeeId(), request.getHodApprovedBy())),
                days.stream().flatMap(day -> Stream.of(day.getEmployeeId(), day.getHodApprovedBy())),
                dayOffs.stream().flatMap(claim -> Stream.of(claim.claim().getEmployeeId(), claim.claim().getHodApprovedBy())),
                late.stream().flatMap(claim -> Stream.of(claim.claim().getEmployeeId(), claim.claim().getHodApprovedBy())))
                .flatMap(ids -> ids).filter(Objects::nonNull).collect(Collectors.toSet()));
        return new Waiting(
                leaveWaiting.stream().map(request -> LeaveRequestResponse.of(request, names.get(request.getEmployeeId()), names)).toList(),
                fixes.stream().map(request -> CorrectionResponse.of(request, names.get(request.getEmployeeId()), names)).toList(),
                days.stream().map(day -> HomeDayResponse.of(day, names)).toList(),
                dayOffs.stream().map(claim -> CompOffResponse.of(claim, names)).toList(),
                late.stream().map(claim -> OvertimeResponse.of(claim, names)).toList());
    }

    // kind is the list it came from: leave, corrections, home-days, comp-offs or overtime.
    @PostMapping("/api/hr/approvals/{kind}/{id}/decision")
    void decide(@PathVariable String kind, @PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = access.require(currentUser.get());
        Corrections.Decision decision = new Corrections.Decision(body.decision(), body.note());
        switch (kind) {
            case "leave" -> leave.decideForHr(me, id, new LeaveService.Decision(body.decision(), body.note()));
            case "corrections" -> corrections.decideForHr(me, id, decision);
            case "home-days" -> homeDays.decideForHr(me, id, decision);
            case "comp-offs" -> compOffs.decideForHr(me, id, decision);
            case "overtime" -> overtimes.decideForHr(me, id, decision);
            default -> throw new ApiException(HttpStatus.NOT_FOUND, "Nothing waiting for HR with that id");
        }
    }

    @GetMapping("/api/hr/approval-rules")
    ApprovalSteps.Rules rules() {
        access.require(currentUser.get());
        return steps.rules();
    }

    @PutMapping("/api/hr/approval-rules")
    ApprovalSteps.Rules saveRules(@Valid @RequestBody RulesBody body) {
        access.require(currentUser.get());
        return steps.save(new ApprovalSteps.Rules(body.punchFixes(), body.homeDays(), body.compOff(), body.overtime()));
    }
}
