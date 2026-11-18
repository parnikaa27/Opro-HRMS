package mv.opro.hrms.hr;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.record.BankAccount;
import mv.opro.hrms.record.Education;
import mv.opro.hrms.record.MedicalInsurance;
import mv.opro.hrms.record.RecordResponses;
import mv.opro.hrms.record.Records;
import mv.opro.hrms.record.WorkExperience;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// HR's side of someone's record: insurance, education and experience, and checking the bank details they enter.
// HR never changes or checks their own.
@Tag(name = "HR: records", description = "Insurance, education, experience and bank details on anyone's record. HR only, never their own.")
@RestController
class HrRecordController {

    private static final int MAX_TEXT = 120;
    private static final int FIRST_YEAR = 1950;
    private static final int LAST_YEAR = 2100;

    record InsuranceBody(@NotBlank @Size(max = 80) String provider, @NotBlank @Size(max = 40) String policyNumber, @NotNull LocalDate expiresOn) {}

    record EducationBody(@NotBlank @Size(max = MAX_TEXT) String qualification, @NotBlank @Size(max = MAX_TEXT) String institution,
            @NotNull @Min(FIRST_YEAR) @Max(LAST_YEAR) Integer completedYear) {}

    record ExperienceBody(@NotBlank @Size(max = MAX_TEXT) String employer, @NotBlank @Size(max = MAX_TEXT) String role, @NotNull LocalDate from,
            LocalDate to) {}

    record DecisionBody(@NotNull @Pattern(regexp = "verified|rejected") String decision, @Size(max = 300) String note) {}

    private final HrAccess hr;
    private final CurrentUser currentUser;
    private final HrPeople hrPeople;
    private final People people;
    private final Records records;

    HrRecordController(HrAccess hr, CurrentUser currentUser, HrPeople hrPeople, People people, Records records) {
        this.hr = hr;
        this.currentUser = currentUser;
        this.hrPeople = hrPeople;
        this.people = people;
        this.records = records;
    }

    @GetMapping("/api/hr/employees/{id}/record")
    RecordResponses.RecordResponse record(@PathVariable String id) {
        hr.require(currentUser.get());
        return RecordResponses.RecordResponse.of(records.of(hrPeople.find(id).getId()), true);
    }

    @PutMapping("/api/hr/employees/{id}/insurance")
    RecordResponses.InsuranceResponse insurance(@PathVariable String id, @Valid @RequestBody InsuranceBody body) {
        MedicalInsurance policy = records.saveInsurance(someoneElse(id), body.provider(), body.policyNumber(), body.expiresOn());
        return new RecordResponses.InsuranceResponse(policy.getProvider(), policy.getPolicyNumber(), policy.getExpiresOn());
    }

    @DeleteMapping("/api/hr/employees/{id}/insurance")
    ResponseEntity<Void> removeInsurance(@PathVariable String id) {
        records.removeInsurance(someoneElse(id));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/hr/employees/{id}/education")
    RecordResponses.EducationResponse addEducation(@PathVariable String id, @Valid @RequestBody EducationBody body) {
        Education entry = records.addEducation(someoneElse(id), body.qualification(), body.institution(), body.completedYear());
        return new RecordResponses.EducationResponse(entry.getId(), entry.getQualification(), entry.getInstitution(), entry.getCompletedYear());
    }

    @DeleteMapping("/api/hr/employees/{id}/education/{entryId}")
    ResponseEntity<Void> removeEducation(@PathVariable String id, @PathVariable String entryId) {
        records.removeEducation(someoneElse(id), entryId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/hr/employees/{id}/experience")
    RecordResponses.ExperienceResponse addExperience(@PathVariable String id, @Valid @RequestBody ExperienceBody body) {
        WorkExperience entry = records.addExperience(someoneElse(id), body.employer(), body.role(), body.from(), body.to());
        return new RecordResponses.ExperienceResponse(entry.getId(), entry.getEmployer(), entry.getRole(), entry.getFromDate(), entry.getToDate());
    }

    @DeleteMapping("/api/hr/employees/{id}/experience/{entryId}")
    ResponseEntity<Void> removeExperience(@PathVariable String id, @PathVariable String entryId) {
        records.removeExperience(someoneElse(id), entryId);
        return ResponseEntity.noContent().build();
    }

    // Bank details waiting for HR, oldest first, with the full number to check against the bank letter.
    @GetMapping("/api/hr/bank-accounts")
    List<RecordResponses.BankResponse> waitingBanks() {
        hr.require(currentUser.get());
        List<BankAccount> waiting = records.waitingBanks();
        Map<String, String> names = people.namesOf(waiting.stream().map(BankAccount::getEmployeeId).collect(Collectors.toSet()));
        return waiting.stream().map(account -> RecordResponses.BankResponse.of(account, names.get(account.getEmployeeId()), true)).toList();
    }

    @PostMapping("/api/hr/employees/{id}/bank-account/decision")
    RecordResponses.BankResponse decideBank(@PathVariable String id, @Valid @RequestBody DecisionBody body) {
        Employee me = hr.require(currentUser.get());
        String employeeId = someoneElse(id);
        BankAccount decided = records.decideBank(me, employeeId, body.decision(), body.note());
        return RecordResponses.BankResponse.of(decided, hrPeople.find(employeeId).getFullName(), true);
    }

    private String someoneElse(String id) {
        Employee me = hr.require(currentUser.get());
        if (id.equals(me.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Another HR person handles your own record.");
        }
        return hrPeople.find(id).getId();
    }
}
