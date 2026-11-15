package mv.opro.hrms.holiday;

import java.time.LocalDate;
import java.time.MonthDay;
import java.util.List;
import java.util.Map;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// HR's changes to the company calendar. Everyone sees the result on their own calendar.
@Service
@Transactional
public class CalendarEditor {

    // Civil holidays fall on the same date every year. Islamic ones move with the moon, so HR adds those by hand.
    private static final Map<MonthDay, String> CIVIL = Map.of(
            MonthDay.of(1, 1), "New Year's Day",
            MonthDay.of(7, 26), "Independence Day",
            MonthDay.of(11, 3), "Victory Day",
            MonthDay.of(11, 11), "Republic Day");

    private final HolidayRepository holidays;
    private final CompanyEventRepository events;
    private final Notifications notifications;

    CalendarEditor(HolidayRepository holidays, CompanyEventRepository events, Notifications notifications) {
        this.holidays = holidays;
        this.events = events;
        this.notifications = notifications;
    }

    public Holiday addHoliday(LocalDate date, String name, boolean isTentative) {
        return holidays.save(new Holiday(Ids.next("HD"), date, name.strip(), isTentative));
    }

    // Confirming an Islamic date after the moon sighting tells everyone, since it may move their plans.
    public Holiday updateHoliday(String id, LocalDate date, String name, boolean isTentative) {
        Holiday holiday = holidays.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Holiday not found"));
        if (holiday.update(date, name.strip(), isTentative)) {
            notifications.tellEveryone(Notification.Kind.HOLIDAY, holiday.getName() + " is confirmed for " + Wording.date(date) + ".");
        }
        return holiday;
    }

    public void deleteHoliday(String id) {
        holidays.delete(holidays.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Holiday not found")));
    }

    // Adds the civil holidays a year doesn't have yet. Running it twice adds nothing the second time.
    public List<Holiday> startYear(int year) {
        List<LocalDate> taken = holidays.findByHolidayDateBetweenOrderByHolidayDate(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31)).stream()
                .map(Holiday::getHolidayDate)
                .toList();
        return CIVIL.entrySet().stream()
                .map(entry -> new Holiday(Ids.next("HD"), entry.getKey().atYear(year), entry.getValue(), false))
                .filter(holiday -> !taken.contains(holiday.getHolidayDate()))
                .map(holidays::save)
                .sorted((first, second) -> first.getHolidayDate().compareTo(second.getHolidayDate()))
                .toList();
    }

    public CompanyEvent addEvent(LocalDate date, String name) {
        return events.save(new CompanyEvent(Ids.next("EV"), date, name.strip()));
    }

    public CompanyEvent updateEvent(String id, LocalDate date, String name) {
        CompanyEvent event = events.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event not found"));
        event.update(date, name.strip());
        return event;
    }

    public void deleteEvent(String id) {
        events.delete(events.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Event not found")));
    }
}
