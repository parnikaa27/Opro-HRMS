package mv.opro.hrms.profile;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// Someone asking HR to change their personal details. Only HR edits the record itself.
@Entity
public class ChangeRequest {

    @Id
    private String id;

    private String employeeId;
    private String field;
    private String details;
    private String status;
    private LocalDate raisedOn;
    private String decidedBy;
    private LocalDate decidedOn;
    private String decisionNote;

    protected ChangeRequest() {}

    static ChangeRequest raise(String id, String employeeId, String field, String details, LocalDate today) {
        ChangeRequest request = new ChangeRequest();
        request.id = id;
        request.employeeId = employeeId;
        request.field = field;
        request.details = details;
        request.status = "open";
        request.raisedOn = today;
        return request;
    }

    public String getId() {
        return id;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public String getField() {
        return field;
    }

    public String getDetails() {
        return details;
    }

    public String getStatus() {
        return status;
    }

    public LocalDate getRaisedOn() {
        return raisedOn;
    }
}
