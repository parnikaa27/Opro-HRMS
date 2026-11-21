package mv.opro.hrms.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import mv.opro.hrms.ApiTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

// Arjun's (OPR-0018) passport copy is on file; HR set passport copies to remind 60 days ahead. Ananya (OPR-0002) is HR,
// Rajesh (OPR-0001) a super admin. Today is 12 November 2026.
@ApiTest
class DocumentRemindersTests {

    private static final int SEEDED_NOTIFICATIONS = 7;

    @Autowired
    VisaReminders reminders;

    @Autowired
    JdbcTemplate jdbc;

    // Only Arjun's passport copy runs out soon. Everything else is pushed far away.
    @BeforeEach
    void onlyArjunsPassport() {
        jdbc.update("update visa set visa_expiry = visa_expiry + interval '100 years', passport_expiry = passport_expiry + interval '100 years'");
        jdbc.update("update employee_document set expires_on = expires_on + interval '100 years' where expires_on is not null and id <> 'OPR-0018-passport'");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("update visa set visa_expiry = visa_expiry - interval '100 years', passport_expiry = passport_expiry - interval '100 years'");
        jdbc.update("update employee_document set expires_on = expires_on - interval '100 years' where expires_on is not null and id <> 'OPR-0018-passport'");
        jdbc.update("update employee_document set expires_on = '2028-02-11' where id = 'OPR-0018-passport'");
        jdbc.update("delete from visa_reminder");
        jdbc.update("delete from notification where id > ?", SEEDED_NOTIFICATIONS);
    }

    private List<String> newFor(String employeeId) {
        return jdbc.queryForList("select text from notification where id > ? and employee_id = ? and text like '%passport copy%' order by id", String.class,
                SEEDED_NOTIFICATIONS, employeeId);
    }

    @Test
    void thePersonAndHrHearAsManyDaysAheadAsHrSet() {
        jdbc.update("update employee_document set expires_on = '2027-01-01' where id = 'OPR-0018-passport'");

        reminders.remind();

        assertThat(newFor("OPR-0018")).containsExactly(
                "Your passport copy expires on 1 January 2027, in 50 days. Upload the new one from Documents, or give it to HR.");
        assertThat(newFor("OPR-0002")).containsExactly("Arjun Reddy's passport copy expires on 1 January 2027, in 50 days.");
        assertThat(newFor("OPR-0001")).isEmpty();
    }

    @Test
    void superAdminsJoinInTheLastWeekAndEachGoesOutOnce() {
        jdbc.update("update employee_document set expires_on = '2026-11-17' where id = 'OPR-0018-passport'");

        reminders.remind();
        reminders.remind();

        assertThat(newFor("OPR-0001")).containsExactly("Arjun Reddy's passport copy expires on Tuesday 17 November, in 5 days.");
        assertThat(newFor("OPR-0018")).hasSize(1);
    }
}
