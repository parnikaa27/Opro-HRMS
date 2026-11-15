package mv.opro.hrms.attendance;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.OffsetDateTime;

// One raw punch, from the portal (app), an old fingerprint device, or added by hand (manual).
// Never changed after it lands: a wrong one is voided, a missing one is added with source manual.
@Entity
public class Punch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String employeeId;
    private OffsetDateTime punchedAt;
    private String deviceId;
    private String source;
    private OffsetDateTime voidedAt;
    private String correctionRequestId;
    private String voidedBy;
    private String workMode;
    private String office;
    private Integer distanceMetres;

    protected Punch() {}

    // Punched from the portal. An office punch names the office it passed at; a home punch has neither.
    static Punch fromApp(String employeeId, OffsetDateTime punchedAt, String workMode, String office, Integer distanceMetres) {
        Punch punch = new Punch();
        punch.employeeId = employeeId;
        punch.punchedAt = punchedAt;
        punch.source = "app";
        punch.workMode = workMode;
        punch.office = office;
        punch.distanceMetres = distanceMetres;
        return punch;
    }

    // Added by hand because a manager approved a punch fix. It points back at that request.
    static Punch fromApprovedFix(String employeeId, OffsetDateTime punchedAt, String correctionRequestId) {
        Punch punch = new Punch();
        punch.employeeId = employeeId;
        punch.punchedAt = punchedAt;
        punch.source = "manual";
        punch.correctionRequestId = correctionRequestId;
        return punch;
    }

    void voidBy(String employeeId, OffsetDateTime at) {
        voidedAt = at;
        voidedBy = employeeId;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public OffsetDateTime getPunchedAt() {
        return punchedAt;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public String getWorkMode() {
        return workMode;
    }

    public String getOffice() {
        return office;
    }

    public boolean isManual() {
        return "manual".equals(source);
    }

    public boolean isVoided() {
        return voidedAt != null;
    }
}
