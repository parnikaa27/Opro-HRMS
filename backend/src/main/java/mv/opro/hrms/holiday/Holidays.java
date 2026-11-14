package mv.opro.hrms.holiday;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// The holiday calendar, for attendance and leave. A tentative date still counts: it is the best date known.
@Service
@Transactional(readOnly = true)
public class Holidays {

    private final HolidayRepository holidays;

    Holidays(HolidayRepository holidays) {
        this.holidays = holidays;
    }

    public List<Holiday> between(LocalDate from, LocalDate to) {
        return holidays.findByHolidayDateBetweenOrderByHolidayDate(from, to);
    }

    public Set<LocalDate> datesBetween(LocalDate from, LocalDate to) {
        return between(from, to).stream().map(Holiday::getHolidayDate).collect(Collectors.toUnmodifiableSet());
    }
}
