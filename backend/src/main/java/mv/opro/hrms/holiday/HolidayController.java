package mv.opro.hrms.holiday;

import java.time.LocalDate;
import java.util.List;
import mv.opro.hrms.employee.People;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Calendar", description = "Public holidays and company events by year.")
@RestController
class HolidayController {

    record HolidayResponse(String id, LocalDate date, String name, boolean isTentative) {}

    record EventResponse(String id, LocalDate date, String name) {}

    private final Holidays holidays;
    private final CompanyEventRepository events;
    private final People people;

    HolidayController(Holidays holidays, CompanyEventRepository events, People people) {
        this.holidays = holidays;
        this.events = events;
        this.people = people;
    }

    @GetMapping("/api/holidays")
    List<HolidayResponse> forYear(@RequestParam(required = false) Integer year) {
        int chosen = year == null ? people.today().getYear() : year;
        return holidays.between(LocalDate.of(chosen, 1, 1), LocalDate.of(chosen, 12, 31)).stream()
                .map(holiday -> new HolidayResponse(holiday.getId(), holiday.getHolidayDate(), holiday.getName(), holiday.isTentative()))
                .toList();
    }

    @GetMapping("/api/events")
    List<EventResponse> eventsForYear(@RequestParam(required = false) Integer year) {
        int chosen = year == null ? people.today().getYear() : year;
        return events.findByEventDateBetweenOrderByEventDate(LocalDate.of(chosen, 1, 1), LocalDate.of(chosen, 12, 31)).stream()
                .map(event -> new EventResponse(event.getId(), event.getEventDate(), event.getName()))
                .toList();
    }
}
