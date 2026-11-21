package mv.opro.hrms.leave;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.stream.IntStream;

// Compensatory off is taken within 14 days of the day worked. Each request uses the days that run out soonest and
// cover its dates. Days nobody used in time are gone.
final class CompOffDays {

    record Earned(LocalDate workedOn, BigDecimal days) {

        LocalDate useBy() {
            return workedOn.plusDays(LeaveType.COMP_OFF_VALID_DAYS);
        }

        boolean covers(Use use) {
            return use.from().isAfter(workedOn) && !use.to().isAfter(useBy());
        }
    }

    record Use(LocalDate from, LocalDate to, BigDecimal days) {}

    private final List<Earned> earned;
    private final BigDecimal[] left;

    // Every existing use is taken first, in date order.
    CompOffDays(List<Earned> earned, List<Use> uses) {
        this.earned = earned.stream().sorted(Comparator.comparing(Earned::workedOn)).toList();
        this.left = this.earned.stream().map(Earned::days).toArray(BigDecimal[]::new);
        uses.stream().sorted(Comparator.comparing(Use::from)).forEach(this::take);
    }

    // Takes the use's days from whatever covers its dates. True when all of it fit.
    boolean take(Use use) {
        BigDecimal needed = use.days();
        for (int i = 0; i < left.length && needed.signum() > 0; i++) {
            if (earned.get(i).covers(use)) {
                BigDecimal taken = needed.min(left[i]);
                left[i] = left[i].subtract(taken);
                needed = needed.subtract(taken);
            }
        }
        return needed.signum() == 0;
    }

    // Days not used yet that can still be taken on or after this day.
    BigDecimal usableFrom(LocalDate day) {
        return usable(day).mapToObj(i -> left[i]).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // When the soonest of those runs out, or null when there are none.
    LocalDate nextUseBy(LocalDate day) {
        return usable(day).mapToObj(i -> earned.get(i).useBy()).findFirst().orElse(null);
    }

    private IntStream usable(LocalDate day) {
        return IntStream.range(0, left.length).filter(i -> left[i].signum() > 0 && !earned.get(i).useBy().isBefore(day));
    }
}
