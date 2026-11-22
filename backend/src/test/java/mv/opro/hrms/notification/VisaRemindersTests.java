package mv.opro.hrms.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import mv.opro.hrms.ApiTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

// On 12 November 2026: Arjun's visa runs out in 38 days, Rohit's ran out on 2 November, Kavya's passport in 59 days.
// All three report to Vikram (OPR-0004). Ananya (OPR-0002) is HR.
@ApiTest
class VisaRemindersTests {

    private static final int SEEDED_NOTIFICATIONS = 7;

    @Autowired
    VisaReminders reminders;

    @Autowired
    JdbcTemplate jdbc;

    // Uploaded copies remind on their own (DocumentRemindersTests). Pushed far out here so only the record's dates count.
    @BeforeEach
    void putCopiesFarAway() {
        jdbc.update("update employee_document set expires_on = expires_on + interval '100 years' where expires_on is not null");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("update employee_document set expires_on = expires_on - interval '100 years' where expires_on is not null");
        jdbc.update("delete from visa_reminder");
        jdbc.update("delete from notification where id > ?", SEEDED_NOTIFICATIONS);
        jdbc.update("update visa set visa_expiry = '2026-12-20', medical_due_on = '2027-04-19', employment_approval_expiry = '2027-12-20' where employee_id = 'OPR-0018'");
        jdbc.update("update medical_insurance set expires_on = '2027-04-30' where employee_id = 'OPR-0018'");
        jdbc.update("update employee set contract_ends_on = '2027-01-15', probation_ends_on = null, date_of_birth = '1996-02-29' where id = 'OPR-0018'");
        jdbc.update("update employee set joined_on = '2023-12-20' where id = 'OPR-0018'");
    }

    private List<String> newFor(String employeeId) {
        return jdbc.queryForList("select text from notification where id > ? and employee_id = ? order by id", String.class, SEEDED_NOTIFICATIONS, employeeId);
    }

    @Test
    void tellsTheHolderWhatToDo() {
        reminders.remind();

        assertThat(newFor("OPR-0018")).containsExactly("Your visa expires on Sunday 20 December, in 38 days. Send your documents to HR.");
        assertThat(newFor("OPR-0021")).containsExactly("Your visa expired on Monday 2 November. Talk to HR today.");
        assertThat(newFor("OPR-0027")).containsExactly("Your passport expires on 10 January 2027, in 59 days. Start the renewal now.");
        assertThat(newFor("OPR-0015")).isEmpty();
    }

    @Test
    void tellsTheirManagerAndHr() {
        reminders.remind();

        List<String> expected = List.of("Arjun Reddy's visa expires on Sunday 20 December, in 38 days.", "Rohit Verma's visa expired on Monday 2 November.",
                "Kavya Menon's passport expires on 10 January 2027, in 59 days.");
        assertThat(newFor("OPR-0004")).containsExactlyInAnyOrderElementsOf(expected);
        assertThat(newFor("OPR-0002")).containsExactlyInAnyOrderElementsOf(expected);
    }

    @Test
    void sendsEachReminderOnce() {
        reminders.remind();
        reminders.remind();

        assertThat(newFor("OPR-0018")).hasSize(1);
        assertThat(jdbc.queryForObject("select count(*) from visa_reminder where employee_id = 'OPR-0018'", Integer.class)).isEqualTo(1);
    }

    @Test
    void sendsOnlyTheMostUrgentAfterAGap() {
        // Down for weeks: the 60 and 30 day reminders were never sent, and it's now 6 days out.
        jdbc.update("update visa set visa_expiry = '2026-11-18' where employee_id = 'OPR-0018'");

        reminders.remind();
        reminders.remind();

        assertThat(newFor("OPR-0018")).containsExactly("Your visa expires on Wednesday 18 November, in 6 days. Send your documents to HR.");
        assertThat(jdbc.queryForList("select notice_days from visa_reminder where employee_id = 'OPR-0018' order by notice_days desc", Integer.class))
                .containsExactly(60, 30, 7);
    }

    @Test
    void theMedicalApprovalAndInsuranceFollowTheSameSteps() {
        jdbc.update("update visa set medical_due_on = '2026-11-20', employment_approval_expiry = '2026-12-01' where employee_id = 'OPR-0018'");
        jdbc.update("update medical_insurance set expires_on = '2026-11-12' where employee_id = 'OPR-0018'");

        reminders.remind();

        assertThat(newFor("OPR-0018")).contains(
                "Your work permit medical is due on Friday 20 November, in 8 days. Book it with HR.",
                "Your employment approval expires on Tuesday 1 December, in 19 days. HR is starting the renewal.",
                "Your medical insurance expires today. Talk to HR today.");
        assertThat(newFor("OPR-0002")).contains("Arjun Reddy's work permit medical is due on Friday 20 November, in 8 days.");
    }

    @Test
    void aContractOrProbationEndingGoesToTheHodAndHrOnly() {
        jdbc.update("update employee set contract_ends_on = '2026-12-10', probation_ends_on = '2026-11-26' where id = 'OPR-0018'");

        reminders.remind();

        assertThat(newFor("OPR-0004")).contains("Arjun Reddy's contract ends on Thursday 10 December, in 28 days.",
                "Arjun Reddy's probation ends on Thursday 26 November, in 14 days.");
        assertThat(newFor("OPR-0002")).contains("Arjun Reddy's probation ends on Thursday 26 November, in 14 days.");
        assertThat(newFor("OPR-0018")).noneMatch(text -> text.contains("contract") || text.contains("probation"));
    }

    @Test
    void birthdaysAndAnniversariesOnTheDayOnce() {
        jdbc.update("update employee set date_of_birth = '1996-11-12', joined_on = '2023-11-12' where id = 'OPR-0018'");

        reminders.remind();
        reminders.remind();

        assertThat(newFor("OPR-0018")).contains("Happy birthday, Arjun. Have a lovely day.", "3 years at Opro today. Thank you, Arjun.");
        assertThat(newFor("OPR-0004")).contains("It's Arjun Reddy's birthday today.", "Arjun Reddy has been at Opro for 3 years today.");
        assertThat(newFor("OPR-0018")).filteredOn(text -> text.startsWith("Happy birthday")).hasSize(1);
    }

    @Test
    void aRenewalStartsTheRemindersAgain() {
        reminders.remind();
        jdbc.update("update visa set visa_expiry = '2027-01-05' where employee_id = 'OPR-0018'");

        reminders.remind();

        assertThat(newFor("OPR-0018")).last().isEqualTo("Your visa expires on 5 January 2027, in 54 days. Send your documents to HR.");
    }
}
