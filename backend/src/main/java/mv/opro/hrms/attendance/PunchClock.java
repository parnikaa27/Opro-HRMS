package mv.opro.hrms.attendance;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Punching in and out from the portal. An office punch has to come from near an office; the server checks the distance,
// never the browser. A home punch needs no location and waits for the manager's approval.
@Service
public class PunchClock {

    static final String OFFICE = "office";
    static final String HOME = "home";
    private static final Duration TOO_SOON = Duration.ofMinutes(1);
    private static final double EARTH_RADIUS_METRES = 6_371_000;
    private static final int METRES_IN_A_KM = 1000;

    // What the browser reported. Accuracy is its own estimate, in metres.
    public record Location(double latitude, double longitude, double accuracy) {}

    private final PunchRepository punches;
    private final HomeDayRepository homeDays;
    private final EmployeeRepository employees;
    private final People people;
    private final Notifications notifications;
    private final PunchSettings settings;
    private final Clock clock;

    PunchClock(PunchRepository punches, HomeDayRepository homeDays, EmployeeRepository employees, People people, Notifications notifications,
            PunchSettings settings, Clock clock) {
        this.punches = punches;
        this.homeDays = homeDays;
        this.employees = employees;
        this.people = people;
        this.notifications = notifications;
        this.settings = settings;
        this.clock = clock;
    }

    @Transactional
    public void punch(Employee employee, String mode, Location location) {
        // One punch at a time per person, so a double tap can't land twice.
        employees.lockById(employee.getId());
        OffsetDateTime now = OffsetDateTime.now(clock).truncatedTo(ChronoUnit.SECONDS);
        LocalDate today = now.toLocalDate();
        ZoneId zone = clock.getZone();
        List<Punch> live = punches.findByEmployeeIdAndPunchedAtGreaterThanEqualAndPunchedAtLessThanOrderByPunchedAt(employee.getId(),
                today.atStartOfDay(zone).toOffsetDateTime(), today.plusDays(1).atStartOfDay(zone).toOffsetDateTime()).stream()
                .filter(punch -> !punch.isVoided())
                .sorted(Comparator.comparing(Punch::getPunchedAt))
                .toList();
        String direction = live.size() % 2 == 0 ? "in" : "out";

        // A day is worked one way. The first punch from the portal decides which.
        String dayMode = live.stream().map(Punch::getWorkMode).filter(Objects::nonNull).findFirst().orElse(mode);
        if (!dayMode.equals(mode)) {
            throw new ApiException(HttpStatus.CONFLICT, "You started today " + (HOME.equals(dayMode) ? "working from home" : "at the office")
                    + ". Punch " + direction + " the same way.");
        }
        if (!live.isEmpty() && Duration.between(live.getLast().getPunchedAt(), now).compareTo(TOO_SOON) < 0) {
            throw new ApiException(HttpStatus.CONFLICT, "You punched a moment ago. Give it a minute before punching again.");
        }

        if (HOME.equals(mode)) {
            punches.save(Punch.fromApp(employee.getId(), now, HOME, null, null));
            startHomeDay(employee, today);
            return;
        }
        Nearest nearest = nearestOffice(location, direction);
        punches.save(Punch.fromApp(employee.getId(), now, OFFICE, nearest.office().name(), (int) Math.round(nearest.metres())));
    }

    private record Nearest(PunchSettings.Office office, double metres) {}

    private Nearest nearestOffice(Location location, String direction) {
        if (location == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Allow location so we can see you're at the office.");
        }
        if (location.accuracy() > settings.maxAccuracyMetres()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Your location is only accurate to about " + distance(location.accuracy())
                    + ", so we can't tell you're at the office. Turn on precise location and try again.");
        }
        Nearest nearest = settings.offices().stream()
                .map(office -> new Nearest(office, metresBetween(location, office)))
                .min(Comparator.comparingDouble(Nearest::metres))
                .orElseThrow(() -> new IllegalStateException("No offices configured under opro.punch.offices"));
        if (nearest.metres() > nearest.office().radiusMetres()) {
            throw new ApiException(HttpStatus.CONFLICT, "You're " + distance(nearest.metres()) + " from " + nearest.office().name() + ". Punch " + direction
                    + " from the office, or choose working from home.");
        }
        return nearest;
    }

    // The first home punch of the day starts the approval.
    private void startHomeDay(Employee employee, LocalDate today) {
        if (homeDays.findByEmployeeIdAndWorkDate(employee.getId(), today).isPresent()) {
            return;
        }
        homeDays.save(new HomeDay(Ids.next("HW"), employee.getId(), today));
        String managerId = employee.getManagerId();
        if (managerId != null && people.findActive(managerId).isPresent()) {
            notifications.tell(managerId, Notification.Kind.APPROVAL, employee.getFullName() + " is working from home today. Approve it from Leave requests.");
        }
    }

    // Haversine: close enough on the scale of an office radius.
    private static double metresBetween(Location from, PunchSettings.Office to) {
        double latitudeChange = Math.toRadians(to.latitude() - from.latitude());
        double longitudeChange = Math.toRadians(to.longitude() - from.longitude());
        double arc = Math.pow(Math.sin(latitudeChange / 2), 2)
                + Math.cos(Math.toRadians(from.latitude())) * Math.cos(Math.toRadians(to.latitude())) * Math.pow(Math.sin(longitudeChange / 2), 2);
        return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(arc));
    }

    // "450 m", or "1.4 km"
    private static String distance(double metres) {
        return metres < METRES_IN_A_KM ? Math.round(metres) + " m" : String.format(Locale.UK, "%.1f km", metres / METRES_IN_A_KM);
    }
}
