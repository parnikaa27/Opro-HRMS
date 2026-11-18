package mv.opro.hrms.record;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// The rest of someone's record: medical insurance, bank details, education and work experience.
// HR keeps all of it except bank details, which the person enters and HR verifies.
@Service
@Transactional(readOnly = true)
public class Records {

    public record Bank(String bankName, String accountName, String accountNumber, String currency) {}

    public record Record(Optional<MedicalInsurance> insurance, Optional<BankAccount> bankAccount, List<Education> education,
            List<WorkExperience> experience) {}

    private final MedicalInsuranceRepository insurance;
    private final BankAccountRepository banks;
    private final EducationRepository education;
    private final WorkExperienceRepository experience;
    private final Notifications notifications;
    private final Clock clock;

    Records(MedicalInsuranceRepository insurance, BankAccountRepository banks, EducationRepository education, WorkExperienceRepository experience,
            Notifications notifications, Clock clock) {
        this.insurance = insurance;
        this.banks = banks;
        this.education = education;
        this.experience = experience;
        this.notifications = notifications;
        this.clock = clock;
    }

    public Record of(String employeeId) {
        return new Record(insurance.findById(employeeId), banks.findById(employeeId), education.findByEmployeeIdOrderByCompletedYearDesc(employeeId),
                experience.findByEmployeeIdOrderByFromDateDesc(employeeId));
    }

    public List<MedicalInsurance> allInsurance() {
        return insurance.findAll();
    }

    // Bank details waiting for HR, oldest first.
    public List<BankAccount> waitingBanks() {
        return banks.findByStatusOrderBySubmittedOn(BankAccount.PENDING);
    }

    @Transactional
    public BankAccount submitBank(Employee employee, Bank bank) {
        BankAccount account = banks.findById(employee.getId()).orElseGet(() -> new BankAccount(employee.getId()));
        account.submit(bank.bankName().strip(), bank.accountName().strip(), bank.accountNumber().replaceAll("\\s", ""), bank.currency(), today());
        return banks.save(account);
    }

    // Sending them back needs a reason, so the person knows what to fix.
    @Transactional
    public BankAccount decideBank(Employee hr, String employeeId, String decision, String note) {
        BankAccount account = banks.findById(employeeId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No bank details to check."));
        if (!account.isPending()) {
            throw new ApiException(HttpStatus.CONFLICT, "These bank details have already been checked.");
        }
        String cleanNote = note == null || note.isBlank() ? null : note.strip();
        boolean isVerified = BankAccount.VERIFIED.equals(decision);
        if (!isVerified && cleanNote == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Say what's wrong, so they can fix it.");
        }
        account.decide(decision, hr.getId(), today(), cleanNote);
        notifications.tell(employeeId, Notification.Kind.RECORD, isVerified
                ? "HR verified your bank details. Your pay goes to this account."
                : "HR sent back your bank details: " + Wording.sentence(cleanNote) + " Enter them again from your profile.");
        return account;
    }

    @Transactional
    public MedicalInsurance saveInsurance(String employeeId, String provider, String policyNumber, LocalDate expiresOn) {
        MedicalInsurance policy = insurance.findById(employeeId).orElseGet(() -> new MedicalInsurance(employeeId));
        policy.change(provider.strip(), policyNumber.strip(), expiresOn);
        notifications.tell(employeeId, Notification.Kind.RECORD, "HR updated your medical insurance. It runs until " + Wording.date(expiresOn, today()) + ".");
        return insurance.save(policy);
    }

    @Transactional
    public void removeInsurance(String employeeId) {
        insurance.deleteById(employeeId);
    }

    @Transactional
    public Education addEducation(String employeeId, String qualification, String institution, int completedYear) {
        if (completedYear > today().getYear()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pick a year that has already happened.");
        }
        return education.save(new Education(Ids.next("ED"), employeeId, qualification.strip(), institution.strip(), completedYear));
    }

    @Transactional
    public void removeEducation(String employeeId, String id) {
        education.delete(education.findByIdAndEmployeeId(id, employeeId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found")));
    }

    @Transactional
    public WorkExperience addExperience(String employeeId, String employer, String role, LocalDate from, LocalDate to) {
        if (to != null && to.isBefore(from)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The end can't be before the start.");
        }
        if (from.isAfter(today())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pick a start that has already happened.");
        }
        return experience.save(new WorkExperience(Ids.next("EX"), employeeId, employer.strip(), role.strip(), from, to));
    }

    @Transactional
    public void removeExperience(String employeeId, String id) {
        experience.delete(experience.findByIdAndEmployeeId(id, employeeId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found")));
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}
