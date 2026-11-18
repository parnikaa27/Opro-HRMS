package mv.opro.hrms.notification;

import java.time.LocalDate;
import java.time.MonthDay;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import mv.opro.hrms.employee.Employee;
import org.springframework.stereotype.Component;

// Birthdays and work anniversaries, on the day: a note to the person, and to their HOD and HR. Run by the morning
// reminders, and logged so each one goes out once a year.
@Component
class PeopleReminders {

    private static final MonthDay LEAP_DAY = MonthDay.of(2, 29);

    private final VisaReminderRepository sent;
    private final Notifications notifications;

    PeopleReminders(VisaReminderRepository sent, Notifications notifications) {
        this.sent = sent;
        this.notifications = notifications;
    }

    void remind(LocalDate today, Map<String, Employee> active, List<Employee> hr) {
        for (Employee person : active.values()) {
            String firstName = person.getFullName().split(" ")[0];
            if (person.getDateOfBirth() != null && isToday(person.getDateOfBirth(), today) && once(person, "birthday", today)) {
                notifications.tell(person.getId(), Notification.Kind.RECORD, "Happy birthday, " + firstName + ". Have a lovely day.");
                aroundThem(person, active, hr).forEach(id -> notifications.tell(id, Notification.Kind.RECORD, "It's " + person.getFullName() + "'s birthday today."));
            }
            long years = ChronoUnit.YEARS.between(person.getJoinedOn(), today);
            if (years >= 1 && isToday(person.getJoinedOn(), today) && once(person, "anniversary", today)) {
                String span = years + (years == 1 ? " year" : " years");
                notifications.tell(person.getId(), Notification.Kind.RECORD, span + " at Opro today. Thank you, " + firstName + ".");
                aroundThem(person, active, hr).forEach(id ->
                        notifications.tell(id, Notification.Kind.RECORD, person.getFullName() + " has been at Opro for " + span + " today."));
            }
        }
    }

    // Their HOD, if they're still here, and everyone in HR, never the person themselves.
    static Set<String> aroundThem(Employee person, Map<String, Employee> active, List<Employee> hr) {
        Set<String> others = new LinkedHashSet<>();
        Optional.ofNullable(person.getManagerId()).filter(active::containsKey).ifPresent(others::add);
        hr.forEach(colleague -> others.add(colleague.getId()));
        others.remove(person.getId());
        return others;
    }

    // Someone born on 29 February celebrates on the 28th in other years.
    private static boolean isToday(LocalDate date, LocalDate today) {
        MonthDay day = MonthDay.from(date);
        MonthDay celebrated = day.equals(LEAP_DAY) && !today.isLeapYear() ? MonthDay.of(2, 28) : day;
        return celebrated.equals(MonthDay.from(today));
    }

    private boolean once(Employee person, String occasion, LocalDate today) {
        if (sent.existsByEmployeeIdAndDocumentAndExpiresOnAndNoticeDays(person.getId(), occasion, today, 0)) {
            return false;
        }
        sent.save(new VisaReminder(person.getId(), occasion, today, 0, today));
        return true;
    }
}
