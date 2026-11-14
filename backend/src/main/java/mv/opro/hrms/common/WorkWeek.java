package mv.opro.hrms.common;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;

// Sunday to Thursday. Friday and Saturday are the weekend in the Maldives.
public final class WorkWeek {

    private static final Set<DayOfWeek> WEEKEND = Set.of(DayOfWeek.FRIDAY, DayOfWeek.SATURDAY);

    private WorkWeek() {}

    public static boolean isWeekend(LocalDate day) {
        return WEEKEND.contains(day.getDayOfWeek());
    }
}
