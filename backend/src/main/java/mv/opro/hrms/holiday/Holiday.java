package mv.opro.hrms.holiday;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

@Entity
public class Holiday {

    @Id
    private String id;

    private LocalDate holidayDate;
    private String name;
    private boolean isTentative;

    protected Holiday() {}

    public String getId() {
        return id;
    }

    public LocalDate getHolidayDate() {
        return holidayDate;
    }

    public String getName() {
        return name;
    }

    public boolean isTentative() {
        return isTentative;
    }
}
