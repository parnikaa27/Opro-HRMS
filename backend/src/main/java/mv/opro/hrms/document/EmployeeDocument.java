package mv.opro.hrms.document;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;
import java.util.UUID;

// An employment document on someone's file: contract, visa copy, passport or national ID, insurance.
@Entity
public class EmployeeDocument {

    @Id
    private String id;

    private String employeeId;
    private String name;
    private String status;
    private LocalDate updatedOn;
    private LocalDate expiresOn;
    private UUID fileId;
    private int sortOrder;

    protected EmployeeDocument() {}

    public String getId() {
        return id;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public String getName() {
        return name;
    }

    public String getStatus() {
        return status;
    }

    public LocalDate getUpdatedOn() {
        return updatedOn;
    }

    public LocalDate getExpiresOn() {
        return expiresOn;
    }

    public UUID getFileId() {
        return fileId;
    }
}
