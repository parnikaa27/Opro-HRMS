package mv.opro.hrms.record;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

// One qualification on someone's record.
@Entity
public class Education {

    @Id
    private String id;

    private String employeeId;
    private String qualification;
    private String institution;
    private int completedYear;

    protected Education() {}

    Education(String id, String employeeId, String qualification, String institution, int completedYear) {
        this.id = id;
        this.employeeId = employeeId;
        this.qualification = qualification;
        this.institution = institution;
        this.completedYear = completedYear;
    }

    public String getId() {
        return id;
    }

    public String getQualification() {
        return qualification;
    }

    public String getInstitution() {
        return institution;
    }

    public int getCompletedYear() {
        return completedYear;
    }
}
