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

    protected Visa() {}

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
}
