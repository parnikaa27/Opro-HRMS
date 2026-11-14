package mv.opro.hrms.leave;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;
import org.junit.jupiter.api.Test;

class WorkingDaysTest {

    private static final LocalDate SUNDAY = LocalDate.of(2026, 12, 6);

    @Test
    void weekendsAndHolidaysInsideTheRangeDontCount() {
        // Sunday 6 to Sunday 13 December, with Friday and Saturday off and a holiday on the Tuesday.
        BigDecimal days = WorkingDays.count(SUNDAY, SUNDAY.plusDays(7), false, Set.of(SUNDAY.plusDays(2)));

        assertThat(days).isEqualByComparingTo("5");
    }

    @Test
    void aHalfDayIsHalfUnlessItFallsOnADayOff() {
        assertThat(WorkingDays.count(SUNDAY, SUNDAY, true, Set.of())).isEqualByComparingTo("0.5");
        assertThat(WorkingDays.count(SUNDAY, SUNDAY, true, Set.of(SUNDAY))).isEqualByComparingTo("0");
    }
}
