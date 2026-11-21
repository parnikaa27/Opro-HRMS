package mv.opro.hrms.onboarding;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

// One person's onboarding: their first day, a buddy, and when every task was done.
@Entity
public class Onboarding {

    public record FirstDay(String time, String place, String contact) {}

    @Id
    private String employeeId;

    private LocalDate startsOn;
    private String firstDayTime;
    private String firstDayPlace;
    private String firstDayContact;
    private String buddyId;
    private LocalDate completedOn;

    protected Onboarding() {}

    Onboarding(String employeeId, LocalDate startsOn) {
        this.employeeId = employeeId;
        this.startsOn = startsOn;
    }

    void setFirstDay(FirstDay firstDay) {
        firstDayTime = firstDay.time();
        firstDayPlace = firstDay.place();
        firstDayContact = firstDay.contact();
    }

    void setBuddy(String id) {
        buddyId = id;
    }

    // Done once every task is ticked. Unticking one opens it again.
    void markComplete(LocalDate on) {
        completedOn = on;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public LocalDate getStartsOn() {
        return startsOn;
    }

    public FirstDay getFirstDay() {
        return new FirstDay(firstDayTime, firstDayPlace, firstDayContact);
    }

    public String getBuddyId() {
        return buddyId;
    }

    public LocalDate getCompletedOn() {
        return completedOn;
    }
}
