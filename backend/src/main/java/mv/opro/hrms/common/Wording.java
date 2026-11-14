package mv.opro.hrms.common;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

// How notifications say dates, times and lengths, so they read like a person wrote them.
public final class Wording {

    private static final DateTimeFormatter LONG_DATE = DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.UK);
    private static final DateTimeFormatter SHORT_DATE = DateTimeFormatter.ofPattern("d MMMM", Locale.UK);
    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("h:mm a", Locale.US);
    private static final BigDecimal HALF = new BigDecimal("0.5");

    private Wording() {}

    // "Tuesday 10 November"
    public static String date(LocalDate day) {
        return day.format(LONG_DATE);
    }

    // "Tuesday 10 November", or "Sunday 6 December to Thursday 10 December"
    public static String dates(LocalDate from, LocalDate to) {
        return from.equals(to) ? date(from) : date(from) + " to " + date(to);
    }

    // "on 18 November", or "from 20 December"
    public static String when(LocalDate from, LocalDate to) {
        return (from.equals(to) ? "on " : "from ") + from.format(SHORT_DATE);
    }

    // "5:20 PM"
    public static String time(LocalTime time) {
        return time.format(CLOCK);
    }

    // "half a day", "1 day", "8 days"
    public static String days(BigDecimal days) {
        if (days.compareTo(HALF) == 0) {
            return "half a day";
        }
        String number = days.stripTrailingZeros().toPlainString();
        return number + (days.compareTo(BigDecimal.ONE) == 0 ? " day" : " days");
    }

    // A reason typed by someone, ending in a full stop either way.
    public static String sentence(String text) {
        String trimmed = text.strip();
        return trimmed.matches(".*[.!?]$") ? trimmed : trimmed + ".";
    }
}
