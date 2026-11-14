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

    protected Punch() {}

    static Punch fromDevice(String employeeId, OffsetDateTime punchedAt, String deviceId) {
        Punch punch = new Punch();
        punch.employeeId = employeeId;
        punch.punchedAt = punchedAt;
        punch.deviceId = deviceId;
        punch.source = "device";
        return punch;
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
