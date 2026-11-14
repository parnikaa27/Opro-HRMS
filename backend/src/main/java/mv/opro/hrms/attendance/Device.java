package mv.opro.hrms.attendance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.OffsetDateTime;

@Entity
public class Device {

    @Id
    private String id;

    private String name;
    private String location;
    private boolean isOnline;
    private OffsetDateTime lastSyncAt;

    protected Device() {}

    // Dev only, until real devices report in: pretend this one just synced.
    void markSynced(OffsetDateTime at) {
        this.isOnline = true;
        this.lastSyncAt = at;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getLocation() {
        return location;
    }

    public boolean isOnline() {
        return isOnline;
    }

    public OffsetDateTime getLastSyncAt() {
        return lastSyncAt;
    }
}
