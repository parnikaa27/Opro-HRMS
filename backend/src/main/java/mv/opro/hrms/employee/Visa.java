package mv.opro.hrms.employee;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// Only expatriate staff have one. The passport is held as its last 4 characters, never in full.
@Entity
public class Visa {

    @Id
    private String employeeId;

    private String workPermitNumber;
    private String visaNumber;

    @Column(name = "passport_last4")
    private String passportLast4;

    private LocalDate passportExpiry;
    private LocalDate visaIssuedOn;
    private LocalDate visaExpiry;
    private String employmentApprovalNumber;
    private LocalDate employmentApprovalExpiry;
    private LocalDate medicalDueOn;

    protected Visa() {}

    // Everything HR records on renewal. The employment approval and medical date are optional.
    public record Papers(String workPermitNumber, String visaNumber, String passportLast4, LocalDate passportExpiry, LocalDate visaIssuedOn,
            LocalDate visaExpiry, String employmentApprovalNumber, LocalDate employmentApprovalExpiry, LocalDate medicalDueOn) {}

    public Visa(String employeeId) {
        this.employeeId = employeeId;
    }

    // Only the last 4 passport characters are ever kept.
    public void renew(Papers papers) {
        workPermitNumber = papers.workPermitNumber();
        visaNumber = papers.visaNumber();
        passportLast4 = papers.passportLast4();
        passportExpiry = papers.passportExpiry();
        visaIssuedOn = papers.visaIssuedOn();
        visaExpiry = papers.visaExpiry();
        employmentApprovalNumber = papers.employmentApprovalNumber();
        employmentApprovalExpiry = papers.employmentApprovalExpiry();
        medicalDueOn = papers.medicalDueOn();
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public String getWorkPermitNumber() {
        return workPermitNumber;
    }

    public String getVisaNumber() {
        return visaNumber;
    }

    public String getPassportLast4() {
        return passportLast4;
    }

    public LocalDate getPassportExpiry() {
        return passportExpiry;
    }

    public LocalDate getVisaIssuedOn() {
        return visaIssuedOn;
    }

    public LocalDate getVisaExpiry() {
        return visaExpiry;
    }

    public String getEmploymentApprovalNumber() {
        return employmentApprovalNumber;
    }

    public LocalDate getEmploymentApprovalExpiry() {
        return employmentApprovalExpiry;
    }

    public LocalDate getMedicalDueOn() {
        return medicalDueOn;
    }
}
