package mv.opro.hrms.record;

import java.time.LocalDate;
import java.util.List;

// Record shapes, matching the frontend's EmployeeRecord field for field. The full account number goes to HR only;
// everyone else sees the last 4.
public final class RecordResponses {

    private static final int LAST = 4;

    public record InsuranceResponse(String provider, String policyNumber, LocalDate expiresOn) {}

    public record BankResponse(String employeeId, String employeeName, String bankName, String accountName, String accountNumber, String accountLast4,
            String currency, String status, LocalDate submittedOn, String decisionNote) {

        public static BankResponse of(BankAccount account, String employeeName, boolean isFull) {
            String number = account.getAccountNumber();
            return new BankResponse(account.getEmployeeId(), employeeName, account.getBankName(), account.getAccountName(), isFull ? number : null,
                    number.substring(Math.max(0, number.length() - LAST)), account.getCurrency(), account.getStatus(), account.getSubmittedOn(),
                    account.getDecisionNote());
        }
    }

    public record EducationResponse(String id, String qualification, String institution, int completedYear) {}

    public record ExperienceResponse(String id, String employer, String role, LocalDate from, LocalDate to) {}

    public record RecordResponse(InsuranceResponse insurance, BankResponse bankAccount, List<EducationResponse> education,
            List<ExperienceResponse> experience) {

        public static RecordResponse of(Records.Record record, boolean isFullBank) {
            return new RecordResponse(
                    record.insurance().map(policy -> new InsuranceResponse(policy.getProvider(), policy.getPolicyNumber(), policy.getExpiresOn()))
                            .orElse(null),
                    record.bankAccount().map(account -> BankResponse.of(account, null, isFullBank)).orElse(null),
                    record.education().stream().map(entry -> new EducationResponse(entry.getId(), entry.getQualification(), entry.getInstitution(),
                            entry.getCompletedYear())).toList(),
                    record.experience().stream().map(entry -> new ExperienceResponse(entry.getId(), entry.getEmployer(), entry.getRole(),
                            entry.getFromDate(), entry.getToDate())).toList());
        }
    }

    private RecordResponses() {}
}
