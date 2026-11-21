package mv.opro.hrms.hr;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import mv.opro.hrms.attendance.AttendanceDay;
import mv.opro.hrms.attendance.AttendanceService;
import mv.opro.hrms.employee.EmergencyContact;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeResponse;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.employee.Photos;
import mv.opro.hrms.employee.Visa;
import mv.opro.hrms.employee.VisaRepository;
import mv.opro.hrms.leave.BalanceAdjustment;
import mv.opro.hrms.leave.LeaveService;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.tags.Tag;

// HR's view of everyone at Opro. Every endpoint starts with HrAccess.
@Tag(name = "HR: people", description = "Everyone at Opro: adding, editing, leaving and visas. HR only.")
@RestController
class HrPeopleController {

    private static final int MAX_TEXT = 120;
    private static final int MAX_REASON = 300;

    record ContactBody(@NotBlank @Size(max = MAX_TEXT) String name, @NotBlank @Size(max = MAX_TEXT) String relation,
            @NotBlank @Size(max = MAX_TEXT) String phone) {}

    record EmployeeBody(
            @NotBlank @Size(max = MAX_TEXT) String fullName,
            @NotBlank @Size(max = MAX_TEXT) String designation,
            @NotBlank @Size(max = MAX_TEXT) String department,
            @NotBlank @Email @Size(max = MAX_TEXT) String email,
            @NotBlank @Size(max = MAX_TEXT) String phone,
            @NotNull LocalDate joinedOn,
            @NotNull @Pattern(regexp = "A\\+|A-|B\\+|B-|AB\\+|AB-|O\\+|O-") String bloodGroup,
            @NotBlank @Size(max = MAX_TEXT) String nationality,
            @NotBlank @Size(max = MAX_TEXT) String workLocation,
            @NotNull @Pattern(regexp = "Permanent|Contract|Casual|Intern") String employmentType,
            String managerId,
            @NotNull @Valid ContactBody emergencyContact,
            @NotNull @Pattern(regexp = "male|female") String gender,
            @NotNull @Past LocalDate dateOfBirth,
            LocalDate probationEndsOn,
            LocalDate contractEndsOn,
            @Size(max = 80) String jobCategory) {

        Employee.Details details() {
            return new Employee.Details(fullName.strip(), designation.strip(), department.strip(), email.strip(), phone.strip(), joinedOn, bloodGroup,
                    nationality.strip(), workLocation.strip(), employmentType, blankToNull(managerId),
                    new EmergencyContact(emergencyContact.name().strip(), emergencyContact.relation().strip(), emergencyContact.phone().strip()),
                    gender, dateOfBirth, probationEndsOn, contractEndsOn, blankToNull(jobCategory));
        }
    }

    record LeavingBody(@NotNull LocalDate lastDay, @NotBlank @Size(max = MAX_REASON) String reason) {}

    record VisaBody(
            @NotBlank @Size(max = 40) String workPermitNumber,
            @NotBlank @Size(max = 40) String visaNumber,
            @NotNull @Pattern(regexp = "[A-Za-z0-9]{4}", message = "has to be exactly 4 letters or numbers") String passportLast4,
            @NotNull LocalDate passportExpiry,
            @NotNull LocalDate visaIssuedOn,
            @NotNull LocalDate visaExpiry,
            @Size(max = 40) String employmentApprovalNumber,
            LocalDate employmentApprovalExpiry,
            LocalDate medicalDueOn) {

        Visa.Papers papers() {
            return new Visa.Papers(workPermitNumber.strip(), visaNumber.strip(), passportLast4.toUpperCase(), passportExpiry, visaIssuedOn, visaExpiry,
                    blankToNull(employmentApprovalNumber), employmentApprovalExpiry, medicalDueOn);
        }
    }

    record HrEmployee(@JsonUnwrapped EmployeeResponse employee, AttendanceDay today) {}

    record AdjustmentResponse(String id, String employeeId, String type, BigDecimal days, String reason, String by, String byName, LocalDate on) {}

    record HrEmployeeDetail(@JsonUnwrapped EmployeeResponse employee, List<LeaveService.Balance> leaveBalances, List<AdjustmentResponse> adjustments) {}

    private final HrAccess hr;
    private final CurrentUser currentUser;
    private final HrPeople hrPeople;
    private final People people;
    private final VisaRepository visas;
    private final Photos photos;
    private final AttendanceService attendance;
    private final LeaveService leave;

    HrPeopleController(HrAccess hr, CurrentUser currentUser, HrPeople hrPeople, People people, VisaRepository visas, Photos photos,
            AttendanceService attendance, LeaveService leave) {
        this.hr = hr;
        this.currentUser = currentUser;
        this.hrPeople = hrPeople;
        this.people = people;
        this.visas = visas;
        this.photos = photos;
        this.attendance = attendance;
        this.leave = leave;
    }

    @GetMapping("/api/hr/employees")
    List<HrEmployee> everyone(@RequestParam(required = false) String include) {
        hr.require(currentUser.get());
        return hrPeople.list("former".equals(include)).stream()
                .map(employee -> new HrEmployee(profile(employee), attendance.today(employee).stream().findFirst().orElse(null)))
                .toList();
    }

    @GetMapping("/api/hr/employees/{id}")
    HrEmployeeDetail one(@PathVariable String id) {
        hr.require(currentUser.get());
        Employee employee = hrPeople.find(id);
        List<BalanceAdjustment> adjustments = leave.adjustmentsOf(id);
        Map<String, String> names = people.namesOf(adjustments.stream().map(BalanceAdjustment::getMadeBy).collect(Collectors.toSet()));
        return new HrEmployeeDetail(profile(employee), leave.balancesOf(id), adjustments.stream()
                .map(change -> new AdjustmentResponse(change.getId(), change.getEmployeeId(), change.getType(), change.getDays(), change.getReason(),
                        change.getMadeBy(), names.get(change.getMadeBy()), change.getMadeOn()))
                .toList());
    }

    @PostMapping("/api/hr/employees")
    EmployeeResponse hire(@Valid @RequestBody EmployeeBody body) {
        hr.require(currentUser.get());
        return profile(hrPeople.hire(body.details()));
    }

    @PutMapping("/api/hr/employees/{id}")
    EmployeeResponse update(@PathVariable String id, @Valid @RequestBody EmployeeBody body) {
        hr.require(currentUser.get());
        return profile(hrPeople.update(id, body.details()));
    }

    @PostMapping("/api/hr/employees/{id}/leaving")
    EmployeeResponse leaving(@PathVariable String id, @Valid @RequestBody LeavingBody body) {
        hr.require(currentUser.get());
        return profile(hrPeople.markLeaving(id, body.lastDay(), body.reason()));
    }

    @DeleteMapping("/api/hr/employees/{id}/leaving")
    EmployeeResponse staying(@PathVariable String id) {
        hr.require(currentUser.get());
        return profile(hrPeople.cancelLeaving(id));
    }

    @PutMapping("/api/hr/employees/{id}/visa")
    EmployeeResponse.VisaResponse visa(@PathVariable String id, @Valid @RequestBody VisaBody body) {
        hr.require(currentUser.get());
        return EmployeeResponse.VisaResponse.of(hrPeople.saveVisa(id, body.papers()));
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }

    private EmployeeResponse profile(Employee employee) {
        return EmployeeResponse.of(employee, people.rolesOf(employee), visas.findById(employee.getId()).orElse(null),
                photos.urlOf(employee.getId()).orElse(null));
    }
}
