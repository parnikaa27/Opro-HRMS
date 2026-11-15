package mv.opro.hrms.leave;

import java.time.LocalDate;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Which days someone is away on approved leave, for attendance. A half day isn't a day off: they still come in.
@Service
@Transactional(readOnly = true)
public class LeaveCalendar {

    private final LeaveRequestRepository requests;

    LeaveCalendar(LeaveRequestRepository requests) {
        this.requests = requests;
    }

    public Set<LocalDate> approvedFullDays(String employeeId, LocalDate from, LocalDate to) {
        return requests.approvedBetween(employeeId, from, to).stream()
                .filter(request -> request.getHalfDay() == null)
                .flatMap(request -> request.getFromDate().datesUntil(request.getToDate().plusDays(1)))
                .filter(day -> !day.isBefore(from) && !day.isAfter(to))
                .collect(Collectors.toUnmodifiableSet());
    }
}
