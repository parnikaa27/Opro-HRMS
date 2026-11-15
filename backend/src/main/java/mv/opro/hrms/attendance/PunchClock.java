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
import java.util.Map;
import java.util.Objects;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.WorkWeek;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.holiday.Holidays;
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
    static final String RESORT = "resort";
    private static final Duration TOO_SOON = Duration.ofMinutes(1);
    private static final double EARTH_RADIUS_METRES = 6_371_000;
    private static final int METRES_IN_A_KM = 1000;
    private static final Map<String, String> STARTED = Map.of(OFFICE, "at the office", HOME, "working from home", RESORT, "at a resort");

    // What the browser reported. Accuracy is its own estimate, in metres.
    public record Location(double latitude, double longitude, double accuracy) {}

    private final PunchRepository punches;
    private final HomeDayRepository homeDays;
    private final CompOffClaimRepository compOffs;
    private final Holidays holidays;
    private final EmployeeRepository employees;
    private final People people;
    private final Notifications notifications;
    private final PunchSettings settings;
    private final Clock clock;

    PunchClock(PunchRepository punches, HomeDayRepository homeDays, CompOffClaimRepository compOffs, Holidays holidays, EmployeeRepository employees,
            People people, Notifications notifications, PunchSettings settings, Clock clock) {
        this.punches = punches;
        this.homeDays = homeDays;
        this.compOffs = compOffs;
        this.holidays = holidays;
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
            throw new ApiException(HttpStatus.CONFLICT, "You started today " + STARTED.get(dayMode) + ". Punch " + direction + " the same way.");
        }
        if (!live.isEmpty() && Duration.between(live.getLast().getPunchedAt(), now).compareTo(TOO_SOON) < 0) {
            throw new ApiException(HttpStatus.CONFLICT, "You punched a moment ago. Give it a minute before punching again.");
        }

        if (HOME.equals(mode)) {
            punches.save(Punch.fromApp(employee.getId(), now, HOME, null, null));
            startHomeDay(employee, today);
        } else {
            Nearest nearest = nearest(RESORT.equals(mode) ? settings.resorts() : settings.offices(), location, mode, direction);
            punches.save(Punch.fromApp(employee.getId(), now, mode, nearest.office().name(), (int) Math.round(nearest.metres())));
        }
        claimCompOff(employee, today);
    }

    // Working a Friday or a public holiday asks the manager for compensatory off, once for the day.
    // Super admins have nobody to ask, so they don't earn it.
    private void claimCompOff(Employee employee, LocalDate today) {
        boolean isDayOff = WorkWeek.isWeekend(today) || holidays.datesBetween(today, today).contains(today);
        if (!isDayOff || employee.isSuperAdmin() || compOffs.existsByEmployeeIdAndWorkDate(employee.getId(), today)) {
            return;
        }
        compOffs.save(new CompOffClaim(Ids.next("CO"), employee.getId(), today));
        String managerId = employee.getManagerId();
        if (managerId != null && people.findActive(managerId).isPresent()) {
            notifications.tell(managerId, Notification.Kind.APPROVAL, employee.getFullName() + " is working on " + Wording.date(today)
                    + ", a day off. Give them compensatory off from Leave requests.");
        }
    }

    private record Nearest(PunchSettings.Office office, double metres) {}

    // The closest place of the kind they chose, if they're inside its radius: 300 m for an office, 5 km for a resort.
    private Nearest nearest(List<PunchSettings.Office> places, Location location, String mode, String direction) {
        String where = RESORT.equals(mode) ? "the resort" : "the office";
        if (location == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Allow location so we can see you're at " + where + ".");
        }
        if (location.accuracy() > settings.maxAccuracyMetres()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Your location is only accurate to about " + distance(location.accuracy())
                    + ", so we can't tell you're at " + where + ". Turn on precise location and try again.");
        }
        Nearest nearest = places.stream()
                .map(place -> new Nearest(place, metresBetween(location, place)))
                .min(Comparator.comparingDouble(Nearest::metres))
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "No " + mode + " locations are set up yet. Ask HR."));
        if (nearest.metres() > nearest.office().radiusMetres()) {
            throw new ApiException(HttpStatus.CONFLICT, "You're " + distance(nearest.metres()) + " from " + nearest.office().name() + ". Punch " + direction
                    + " at " + where + ", or choose another option.");
        }
        return nearest;
    }

    // The first home punch of the day starts the approval. A super admin's is approved straight away.
    private void startHomeDay(Employee employee, LocalDate today) {
        if (homeDays.findByEmployeeIdAndWorkDate(employee.getId(), today).isPresent()) {
            return;
        }
        HomeDay day = homeDays.save(new HomeDay(Ids.next("HW"), employee.getId(), today));
        if (employee.isSuperAdmin()) {
            day.decide("approved", employee.getId(), today, null);
            return;
        }
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
