package mv.opro.hrms.record;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// The account someone's pay goes to. They enter it; HR verifies it, or sends it back with a reason.
@Entity
public class BankAccount {

    static final String PENDING = "pending";
    static final String VERIFIED = "verified";

    @Id
    private String employeeId;

    private String bankName;
    private String accountName;
    private String accountNumber;
    private String currency;
    private String status;
    private LocalDate submittedOn;
    private String decidedBy;
    private LocalDate decidedOn;
    private String decisionNote;

    protected BankAccount() {}

    BankAccount(String employeeId) {
        this.employeeId = employeeId;
    }

    // New details always wait for HR again.
    void submit(String bankName, String accountName, String accountNumber, String currency, LocalDate on) {
        this.bankName = bankName;
        this.accountName = accountName;
        this.accountNumber = accountNumber;
        this.currency = currency;
        status = PENDING;
        submittedOn = on;
        decidedBy = null;
        decidedOn = null;
        decisionNote = null;
    }

    void decide(String decision, String by, LocalDate on, String note) {
        status = decision;
        decidedBy = by;
        decidedOn = on;
        decisionNote = note;
    }

    boolean isPending() {
        return PENDING.equals(status);
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public String getBankName() {
        return bankName;
    }

    public String getAccountName() {
        return accountName;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public String getCurrency() {
        return currency;
    }

    public String getStatus() {
        return status;
    }

    public LocalDate getSubmittedOn() {
        return submittedOn;
    }

    public String getDecisionNote() {
        return decisionNote;
    }
}
