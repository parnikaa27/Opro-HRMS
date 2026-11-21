package mv.opro.hrms.allowance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// A kind of allowance on HR's list, like housing. A used one is retired, so history keeps its name.
@Entity
public class AllowanceType {

    @Id
    private String code;

    private String name;
    private int sortOrder;
    private LocalDate retiredOn;

    protected AllowanceType() {}

    AllowanceType(String code, String name, int sortOrder) {
        this.code = code;
        this.name = name;
        this.sortOrder = sortOrder;
    }

    void retire(LocalDate on) {
        retiredOn = on;
    }

    boolean isRetired() {
        return retiredOn != null;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    int getSortOrder() {
        return sortOrder;
    }

    public LocalDate getRetiredOn() {
        return retiredOn;
    }
}
