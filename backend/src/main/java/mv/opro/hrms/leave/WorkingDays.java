package mv.opro.hrms.leave;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;
import mv.opro.hrms.common.WorkWeek;

// How many days a request takes off a balance: weekends and public holidays inside the range don't count.
final class WorkingDays {

    private static final BigDecimal HALF = new BigDecimal("0.5");

    private WorkingDays() {}

    static BigDecimal count(LocalDate from, LocalDate to, boolean isHalfDay, Set<LocalDate> holidays) {
        long days = from.datesUntil(to.plusDays(1)).filter(day -> !WorkWeek.isWeekend(day) && !holidays.contains(day)).count();
        return isHalfDay && days > 0 ? HALF : BigDecimal.valueOf(days);
    }
}
