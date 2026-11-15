package mv.opro.hrms.attendance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

// A fingerprint reader Opro used before punching moved into the portal. Kept so old punches still say where they came from.
@Entity
public class Device {

    @Id
    private String id;

    private String name;

    protected Device() {}

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }
}
