package mv.opro.hrms.notification;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.LocalDate;

// One expiry reminder that has gone out.
@Entity
class VisaReminder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String employeeId;
    private String document;
    private LocalDate expiresOn;
    private int noticeDays;
    private LocalDate sentOn;

    protected VisaReminder() {}

    VisaReminder(String employeeId, String document, LocalDate expiresOn, int noticeDays, LocalDate sentOn) {
        this.employeeId = employeeId;
        this.document = document;
        this.expiresOn = expiresOn;
        this.noticeDays = noticeDays;
        this.sentOn = sentOn;
    }
}
