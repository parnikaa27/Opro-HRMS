package mv.opro.hrms.common;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Set;

// Saturday to Thursday. Friday is Opro's only day off each week.
public final class WorkWeek {

    private static final Set<DayOfWeek> WEEKEND = Set.of(DayOfWeek.FRIDAY);

    private WorkWeek() {}

    public static boolean isWeekend(LocalDate day) {
        return WEEKEND.contains(day.getDayOfWeek());
    }
}
