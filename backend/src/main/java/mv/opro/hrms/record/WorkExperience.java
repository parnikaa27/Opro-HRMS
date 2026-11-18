package mv.opro.hrms.record;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// One job before Opro. toDate is left out for a job still running when they joined.
@Entity
public class WorkExperience {

    @Id
    private String id;

    private String employeeId;
    private String employer;
    private String role;
    private LocalDate fromDate;
    private LocalDate toDate;

    protected WorkExperience() {}

    WorkExperience(String id, String employeeId, String employer, String role, LocalDate fromDate, LocalDate toDate) {
        this.id = id;
        this.employeeId = employeeId;
        this.employer = employer;
        this.role = role;
        this.fromDate = fromDate;
        this.toDate = toDate;
    }

    public String getId() {
        return id;
    }

    public String getEmployer() {
        return employer;
    }

    public String getRole() {
        return role;
    }

    public LocalDate getFromDate() {
        return fromDate;
    }

    public LocalDate getToDate() {
        return toDate;
    }
}
