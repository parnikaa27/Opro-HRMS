package mv.opro.hrms.onboarding;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

// A task on HR's onboarding list: who does it, and how many days from the joining date it's due (negative is before).
@Entity
public class OnboardingTask {

    @Id
    private String id;

    private String name;
    private String owner;
    private int dueInDays;
    private int sortOrder;

    protected OnboardingTask() {}

    OnboardingTask(String id, String name, String owner, int dueInDays, int sortOrder) {
        this.id = id;
        this.name = name;
        this.owner = owner;
        this.dueInDays = dueInDays;
        this.sortOrder = sortOrder;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getOwner() {
        return owner;
    }

    public int getDueInDays() {
        return dueInDays;
    }

    int getSortOrder() {
        return sortOrder;
    }
}
