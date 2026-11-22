package mv.opro.hrms.performance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

// One of a person's goals in a cycle. Weights add up to 100. Rated 1 to 5 when the HOD appraises them.
@Entity
public class Goal {

    @Id
    private String id;

    private String cycleId;
    private String employeeId;
    private String title;
    private String measure;
    private int weight;
    private int sortOrder;
    private Integer rating;
    private String comment;

    protected Goal() {}

    Goal(String id, String cycleId, String employeeId, String title, String measure, int weight, int sortOrder) {
        this.id = id;
        this.cycleId = cycleId;
        this.employeeId = employeeId;
        this.title = title;
        this.measure = measure;
        this.weight = weight;
        this.sortOrder = sortOrder;
    }

    void rate(int given, String note) {
        rating = given;
        comment = note;
    }

    public String getId() {
        return id;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public String getTitle() {
        return title;
    }

    public String getMeasure() {
        return measure;
    }

    public int getWeight() {
        return weight;
    }

    public Integer getRating() {
        return rating;
    }

    public String getComment() {
        return comment;
    }
}
