package mv.opro.hrms.notification;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.document.Documents;
import mv.opro.hrms.employee.Employee;
import org.springframework.stereotype.Component;

// Uploaded documents that run out, like a passport copy. The person and HR hear as many days ahead as HR set for the
// type, super admins join them in the last week, and everyone hears on the day. Run by the morning reminders, and
// logged so each one goes out once; a renewed copy has a new date, which starts them again.
@Component
class DocumentReminders {

    private static final int LAST_WEEK = 7;

    private final Documents documents;
    private final VisaReminderRepository sent;
    private final Notifications notifications;

    DocumentReminders(Documents documents, VisaReminderRepository sent, Notifications notifications) {
        this.documents = documents;
        this.sent = sent;
        this.notifications = notifications;
    }

    void remind(LocalDate today, Map<String, Employee> active, List<Employee> hr) {
        List<Employee> superAdmins = active.values().stream().filter(Employee::isSuperAdmin).toList();
        for (Documents.Expiring document : documents.expiring()) {
            Employee holder = active.get(document.employeeId());
            if (holder != null) {
                remind(holder, document, today, hr, superAdmins);
            }
        }
    }

    private void remind(Employee holder, Documents.Expiring document, LocalDate today, List<Employee> hr, List<Employee> superAdmins) {
        String key = "doc:" + document.typeCode();
        long daysLeft = ChronoUnit.DAYS.between(today, document.expiresOn());
        List<Integer> due = Stream.of(document.remindDaysBefore(), LAST_WEEK, 0).distinct().sorted((first, second) -> second - first)
                .filter(days -> daysLeft <= days).toList();
        if (due.isEmpty() || sent.existsByEmployeeIdAndDocumentAndExpiresOnAndNoticeDays(holder.getId(), key, document.expiresOn(), due.getLast())) {
            return;
        }
        // Only the most urgent reminder goes out. The earlier ones are logged too, so they never arrive late.
        due.stream()
                .filter(days -> !sent.existsByEmployeeIdAndDocumentAndExpiresOnAndNoticeDays(holder.getId(), key, document.expiresOn(), days))
                .forEach(days -> sent.save(new VisaReminder(holder.getId(), key, document.expiresOn(), days, today)));

        String name = document.name().toLowerCase();
        String date = Wording.date(document.expiresOn(), today);
        String when = daysLeft > 0 ? "expires on " + date + ", in " + daysLeft + (daysLeft == 1 ? " day" : " days")
                : daysLeft == 0 ? "expires today" : "expired on " + date;
        notifications.tell(holder.getId(), Notification.Kind.RECORD, "Your " + name + " " + when + ". Upload the new one from Documents, or give it to HR.");
        Set<String> others = new LinkedHashSet<>();
        hr.forEach(person -> others.add(person.getId()));
        if (daysLeft <= LAST_WEEK) {
            superAdmins.forEach(person -> others.add(person.getId()));
        }
        others.remove(holder.getId());
        others.forEach(id -> notifications.tell(id, Notification.Kind.RECORD, holder.getFullName() + "'s " + name + " " + when + "."));
    }
}
