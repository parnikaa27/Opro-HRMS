package mv.opro.hrms.onboarding;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// One person's copy of an onboarding task, with its own due date. Whoever owns it ticks it.
@Entity
public class OnboardingItem {

    static final String HR = "hr";
    static final String HOD = "hod";

    @Id
    private String id;

    private String employeeId;
    private String name;
    private String owner;
    private LocalDate dueOn;
    private int sortOrder;
    private LocalDate doneOn;
    private String doneBy;

    protected OnboardingItem() {}

    OnboardingItem(String id, String employeeId, String name, String owner, LocalDate dueOn, int sortOrder) {
        this.id = id;
        this.employeeId = employeeId;
        this.name = name;
        this.owner = owner;
        this.dueOn = dueOn;
        this.sortOrder = sortOrder;
    }

    void tick(String by, LocalDate on) {
        doneBy = by;
        doneOn = on;
    }

    void untick() {
        doneBy = null;
        doneOn = null;
    }

    boolean isDone() {
        return doneOn != null;
    }

    public String getId() {
        return id;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public String getName() {
        return name;
    }

    public String getOwner() {
        return owner;
    }

    public LocalDate getDueOn() {
        return dueOn;
    }

    public LocalDate getDoneOn() {
        return doneOn;
    }

    public String getDoneBy() {
        return doneBy;
    }
}
