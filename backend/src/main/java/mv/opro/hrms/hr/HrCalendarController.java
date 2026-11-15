package mv.opro.hrms.hr;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import mv.opro.hrms.holiday.CalendarEditor;
import mv.opro.hrms.holiday.CompanyEvent;
import mv.opro.hrms.holiday.Holiday;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
class HrCalendarController {

    private static final int MAX_NAME = 60;
    private static final int FIRST_YEAR = 2000;
    private static final int LAST_YEAR = 2100;

    record HolidayBody(@NotNull LocalDate date, @NotBlank @Size(max = MAX_NAME) String name, boolean isTentative) {}

    record StartYearBody(@NotNull @Min(FIRST_YEAR) @Max(LAST_YEAR) Integer year) {}

    record EventBody(@NotNull LocalDate date, @NotBlank @Size(max = MAX_NAME) String name) {}

    record HolidayResponse(String id, LocalDate date, String name, boolean isTentative) {

        static HolidayResponse of(Holiday holiday) {
            return new HolidayResponse(holiday.getId(), holiday.getHolidayDate(), holiday.getName(), holiday.isTentative());
        }
    }

    record EventResponse(String id, LocalDate date, String name) {

        static EventResponse of(CompanyEvent event) {
            return new EventResponse(event.getId(), event.getEventDate(), event.getName());
        }
    }

    private final HrAccess hr;
    private final CurrentUser currentUser;
    private final CalendarEditor calendar;

    HrCalendarController(HrAccess hr, CurrentUser currentUser, CalendarEditor calendar) {
        this.hr = hr;
        this.currentUser = currentUser;
        this.calendar = calendar;
    }

    @PostMapping("/api/hr/holidays")
    HolidayResponse addHoliday(@Valid @RequestBody HolidayBody body) {
        hr.require(currentUser.get());
        return HolidayResponse.of(calendar.addHoliday(body.date(), body.name(), body.isTentative()));
    }

    @PostMapping("/api/hr/holidays/start-year")
    List<HolidayResponse> startYear(@Valid @RequestBody StartYearBody body) {
        hr.require(currentUser.get());
        return calendar.startYear(body.year()).stream().map(HolidayResponse::of).toList();
    }

    @PutMapping("/api/hr/holidays/{id}")
    HolidayResponse updateHoliday(@PathVariable String id, @Valid @RequestBody HolidayBody body) {
        hr.require(currentUser.get());
        return HolidayResponse.of(calendar.updateHoliday(id, body.date(), body.name(), body.isTentative()));
    }

    @DeleteMapping("/api/hr/holidays/{id}")
    ResponseEntity<Void> deleteHoliday(@PathVariable String id) {
        hr.require(currentUser.get());
        calendar.deleteHoliday(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/hr/events")
    EventResponse addEvent(@Valid @RequestBody EventBody body) {
        hr.require(currentUser.get());
        return EventResponse.of(calendar.addEvent(body.date(), body.name()));
    }

    @PutMapping("/api/hr/events/{id}")
    EventResponse updateEvent(@PathVariable String id, @Valid @RequestBody EventBody body) {
        hr.require(currentUser.get());
        return EventResponse.of(calendar.updateEvent(id, body.date(), body.name()));
    }

    @DeleteMapping("/api/hr/events/{id}")
    ResponseEntity<Void> deleteEvent(@PathVariable String id) {
        hr.require(currentUser.get());
        calendar.deleteEvent(id);
        return ResponseEntity.noContent().build();
    }
}
