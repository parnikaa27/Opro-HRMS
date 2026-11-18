package mv.opro.hrms.record;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// Someone's medical insurance through Opro. HR keeps it; reminders follow its expiry.
@Entity
public class MedicalInsurance {

    @Id
    private String employeeId;

    private String provider;
    private String policyNumber;
    private LocalDate expiresOn;

    protected MedicalInsurance() {}

    MedicalInsurance(String employeeId) {
        this.employeeId = employeeId;
    }

    void change(String provider, String policyNumber, LocalDate expiresOn) {
        this.provider = provider;
        this.policyNumber = policyNumber;
        this.expiresOn = expiresOn;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public String getProvider() {
        return provider;
    }

    public String getPolicyNumber() {
        return policyNumber;
    }

    public LocalDate getExpiresOn() {
        return expiresOn;
    }
}
