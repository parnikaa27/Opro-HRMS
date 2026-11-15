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

    Holiday(String id, LocalDate date, String name, boolean isTentative) {
        this.id = id;
        this.holidayDate = date;
        this.name = name;
        this.isTentative = isTentative;
    }

    // Returns true when this change confirms a date that was tentative, so everyone can be told.
    boolean update(LocalDate date, String name, boolean isTentative) {
        boolean isConfirming = this.isTentative && !isTentative;
        this.holidayDate = date;
        this.name = name;
        this.isTentative = isTentative;
        return isConfirming;
    }

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
