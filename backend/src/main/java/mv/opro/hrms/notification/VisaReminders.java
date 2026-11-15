package mv.opro.hrms.notification;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.employee.Visa;
import mv.opro.hrms.employee.VisaRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Tells people when a visa or passport is about to run out: the holder, their manager and HR.
// The log means a reminder missed while the server was down still goes out, once.
@Service
public class VisaReminders {

    // 60 matches "Expiring soon" on screen. 0 is the day it runs out, or any day after.
    private static final List<Integer> NOTICE_DAYS = List.of(60, 30, 7, 0);
    private static final DateTimeFormatter THIS_YEAR = DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.UK);
    private static final DateTimeFormatter OTHER_YEAR = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.UK);

    private final VisaRepository visas;
    private final VisaReminderRepository sent;
    private final People people;
    private final Notifications notifications;
    private final Clock clock;

    // Every morning at 8, and on start up. Tests turn this off and call remind() themselves.
    @Component
    @ConditionalOnProperty(name = "opro.visa-reminders.scheduled", matchIfMissing = true)
    static class Schedule {

        private final VisaReminders reminders;

        Schedule(VisaReminders reminders) {
            this.reminders = reminders;
        }

        @EventListener(ApplicationReadyEvent.class)
        @Scheduled(cron = "0 0 8 * * *", zone = "${opro.time-zone}")
        void run() {
            reminders.remind();
        }
    }

    VisaReminders(VisaRepository visas, VisaReminderRepository sent, People people, Notifications notifications, Clock clock) {
        this.visas = visas;
        this.sent = sent;
        this.people = people;
        this.notifications = notifications;
        this.clock = clock;
    }

    @Transactional
    public void remind() {
        LocalDate today = LocalDate.now(clock);
        Map<String, Employee> active = people.active().stream().collect(Collectors.toMap(Employee::getId, Function.identity()));
        List<Employee> hr = active.values().stream().filter(Employee::isHr).toList();
        for (Visa visa : visas.findAll()) {
            Employee holder = active.get(visa.getEmployeeId());
            if (holder != null) {
                remind(holder, "visa", visa.getVisaExpiry(), today, active, hr);
                remind(holder, "passport", visa.getPassportExpiry(), today, active, hr);
            }
        }
    }

    private void remind(Employee holder, String document, LocalDate expiresOn, LocalDate today, Map<String, Employee> active, List<Employee> hr) {
        long daysLeft = ChronoUnit.DAYS.between(today, expiresOn);
        List<Integer> due = NOTICE_DAYS.stream().filter(days -> daysLeft <= days).toList();
        if (due.isEmpty() || sent.existsByEmployeeIdAndDocumentAndExpiresOnAndNoticeDays(holder.getId(), document, expiresOn, due.getLast())) {
            return;
        }
        // Only the most urgent reminder goes out. The earlier ones are logged too, so they never arrive late.
        due.stream()
                .filter(days -> !sent.existsByEmployeeIdAndDocumentAndExpiresOnAndNoticeDays(holder.getId(), document, expiresOn, days))
                .forEach(days -> sent.save(new VisaReminder(holder.getId(), document, expiresOn, days, today)));

        String date = expiresOn.format(expiresOn.getYear() == today.getYear() ? THIS_YEAR : OTHER_YEAR);
        String when = daysLeft > 0 ? "expires on " + date + ", in " + daysLeft + (daysLeft == 1 ? " day" : " days")
                : daysLeft == 0 ? "expires today" : "expired on " + date;
        String nextStep = daysLeft <= 0 ? "Talk to HR today." : "visa".equals(document) ? "Send your documents to HR." : "Start the renewal now.";
        notifications.tell(holder.getId(), Notification.Kind.VISA, "Your " + document + " " + when + ". " + nextStep);

        Set<String> others = new LinkedHashSet<>();
        Optional.ofNullable(holder.getManagerId()).filter(active::containsKey).ifPresent(others::add);
        hr.forEach(person -> others.add(person.getId()));
        others.remove(holder.getId());
        others.forEach(id -> notifications.tell(id, Notification.Kind.VISA, holder.getFullName() + "'s " + document + " " + when + "."));
    }
}
