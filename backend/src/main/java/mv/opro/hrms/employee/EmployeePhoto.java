package mv.opro.hrms.employee;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.util.UUID;

@Entity
public class EmployeePhoto {

    @Id
    private String employeeId;

    private UUID fileId;

    // Goes in the photo's URL, so a new photo is never hidden behind a cached old one.
    private String version;

    protected EmployeePhoto() {}

    EmployeePhoto(String employeeId, UUID fileId, String version) {
        this.employeeId = employeeId;
        this.fileId = fileId;
        this.version = version;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public UUID getFileId() {
        return fileId;
    }

    public String getVersion() {
        return version;
    }
}
