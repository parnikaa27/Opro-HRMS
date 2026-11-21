package mv.opro.hrms.notification;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.employee.Visa;
import mv.opro.hrms.employee.VisaRepository;
import mv.opro.hrms.record.MedicalInsurance;
import mv.opro.hrms.record.Records;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Tells people when something on their record is about to run out: visa, passport, work permit medical, employment
// approval and medical insurance go to the holder, their HOD and HR. A contract or probation ending goes to HR and the
// HOD only, since the person hears from them first. The log means a reminder missed while the server was down still
// goes out, once.
@Service
public class VisaReminders {

    // 60 matches "Expiring soon" on screen. 0 is the day it runs out, or any day after.
    private static final List<Integer> NOTICE_DAYS = List.of(60, 30, 7, 0);
    private static final List<Integer> PROBATION_DAYS = List.of(14, 0);

    // What runs out, how it's said, and who hears. document is the key in the reminder log.
    private record Kind(String document, String label, String verb, String pastVerb, String nextStep, List<Integer> notices, boolean tellsHolder) {}

    private static final Kind VISA = new Kind("visa", "visa", "expires", "expired", "Send your documents to HR.", NOTICE_DAYS, true);
    private static final Kind PASSPORT = new Kind("passport", "passport", "expires", "expired", "Start the renewal now.", NOTICE_DAYS, true);
    private static final Kind MEDICAL = new Kind("medical", "work permit medical", "is due", "was due", "Book it with HR.", NOTICE_DAYS, true);
    private static final Kind APPROVAL = new Kind("approval", "employment approval", "expires", "expired", "HR is starting the renewal.", NOTICE_DAYS,
            true);
    private static final Kind INSURANCE = new Kind("insurance", "medical insurance", "expires", "expired", "HR is renewing it.", NOTICE_DAYS, true);
    private static final Kind CONTRACT = new Kind("contract", "contract", "ends", "ended", "", NOTICE_DAYS, false);
    private static final Kind PROBATION = new Kind("probation", "probation", "ends", "ended", "", PROBATION_DAYS, false);

    private final VisaRepository visas;
    private final Records records;
    private final VisaReminderRepository sent;
    private final People people;
    private final Notifications notifications;
    private final PeopleReminders peopleReminders;
    private final DocumentReminders documentReminders;
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

    VisaReminders(VisaRepository visas, Records records, VisaReminderRepository sent, People people, Notifications notifications,
            PeopleReminders peopleReminders, DocumentReminders documentReminders, Clock clock) {
        this.visas = visas;
        this.records = records;
        this.sent = sent;
        this.people = people;
        this.notifications = notifications;
        this.peopleReminders = peopleReminders;
        this.documentReminders = documentReminders;
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
                remind(holder, VISA, visa.getVisaExpiry(), today, active, hr);
                remind(holder, PASSPORT, visa.getPassportExpiry(), today, active, hr);
                remind(holder, MEDICAL, visa.getMedicalDueOn(), today, active, hr);
                remind(holder, APPROVAL, visa.getEmploymentApprovalExpiry(), today, active, hr);
            }
        }
        for (MedicalInsurance policy : records.allInsurance()) {
            Optional.ofNullable(active.get(policy.getEmployeeId())).ifPresent(holder -> remind(holder, INSURANCE, policy.getExpiresOn(), today, active, hr));
        }
        for (Employee person : active.values()) {
            remind(person, CONTRACT, person.getContractEndsOn(), today, active, hr);
            remind(person, PROBATION, person.getProbationEndsOn(), today, active, hr);
        }
        peopleReminders.remind(today, active, hr);
        documentReminders.remind(today, active, hr);
    }

    private void remind(Employee holder, Kind kind, LocalDate expiresOn, LocalDate today, Map<String, Employee> active, List<Employee> hr) {
        if (expiresOn == null) {
            return;
        }
        long daysLeft = ChronoUnit.DAYS.between(today, expiresOn);
        List<Integer> due = kind.notices().stream().filter(days -> daysLeft <= days).toList();
        if (due.isEmpty() || sent.existsByEmployeeIdAndDocumentAndExpiresOnAndNoticeDays(holder.getId(), kind.document(), expiresOn, due.getLast())) {
            return;
        }
        // Only the most urgent reminder goes out. The earlier ones are logged too, so they never arrive late.
        due.stream()
                .filter(days -> !sent.existsByEmployeeIdAndDocumentAndExpiresOnAndNoticeDays(holder.getId(), kind.document(), expiresOn, days))
                .forEach(days -> sent.save(new VisaReminder(holder.getId(), kind.document(), expiresOn, days, today)));

        String date = Wording.date(expiresOn, today);
        String when = daysLeft > 0 ? kind.verb() + " on " + date + ", in " + daysLeft + (daysLeft == 1 ? " day" : " days")
                : daysLeft == 0 ? kind.verb() + " today" : kind.pastVerb() + " on " + date;
        if (kind.tellsHolder()) {
            String nextStep = daysLeft <= 0 ? "Talk to HR today." : kind.nextStep();
            notifications.tell(holder.getId(), Notification.Kind.VISA, "Your " + kind.label() + " " + when + ". " + nextStep);
        }
        PeopleReminders.aroundThem(holder, active, hr).forEach(id ->
                notifications.tell(id, Notification.Kind.VISA, holder.getFullName() + "'s " + kind.label() + " " + when + "."));
    }
}
