package mv.opro.hrms.attendance;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.OffsetDateTime;

// One raw punch. Never changed after it lands: a wrong one is voided, a missing one is added with source manual.
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

    protected Punch() {}

    static Punch fromDevice(String employeeId, OffsetDateTime punchedAt, String deviceId) {
        Punch punch = new Punch();
        punch.employeeId = employeeId;
        punch.punchedAt = punchedAt;
        punch.deviceId = deviceId;
        punch.source = "device";
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

    // Added by HR, with the reason kept in the punch edit log.
    static Punch addedByHr(String employeeId, OffsetDateTime punchedAt) {
        Punch punch = new Punch();
        punch.employeeId = employeeId;
        punch.punchedAt = punchedAt;
        punch.source = "manual";
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

    public boolean isManual() {
        return "manual".equals(source);
    }

    public boolean isVoided() {
        return voidedAt != null;
    }
}
