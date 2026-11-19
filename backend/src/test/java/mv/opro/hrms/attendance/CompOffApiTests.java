package mv.opro.hrms.attendance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import mv.opro.hrms.ApiClient;
import mv.opro.hrms.ApiTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

// Arjun (OPR-0018) reports to Vikram (OPR-0004). Friday 6 November 2026 was a day off. Today is Thursday 12 November.
@ApiTest
class CompOffApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient vikram;

    @BeforeEach
    void signIn() throws Exception {
        vikram = as("OPR-0004");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from punch");
        jdbc.update("delete from home_day");
        jdbc.update("delete from leave_request where type = 'comp-off'");
        jdbc.update("delete from comp_off_claim");
        jdbc.update("delete from balance_adjustment where id <> 'BA-1'");
        jdbc.update("delete from leave_entitlement where type = 'comp-off'");
        jdbc.update("delete from holiday where id = 'HD-TEST'");
        jdbc.update("delete from notification where id > ?", SEEDED_NOTIFICATIONS);
    }

    private ApiClient as(String employeeId) throws Exception {
        ApiClient client = new ApiClient(port);
        client.signIn(employeeId);
        return client;
    }

    private void workedFriday(String... times) {
        for (String time : times) {
            jdbc.update("insert into punch (employee_id, punched_at, source, work_mode, office) values ('OPR-0018', ?::timestamptz, 'app', 'office', 'Malé office')",
                    "2026-11-06T" + time + ":00+05:00");
        }
        jdbc.update("insert into comp_off_claim (id, employee_id, work_date) values ('CO-TEST', 'OPR-0018', '2026-11-06')");
    }

    private String compOff(ApiClient client) throws Exception {
        List<Object> found = JsonPath.read(client.get("/api/leave/balances").body(), "$[?(@.type == 'comp-off')].entitled");
        return found.isEmpty() ? "none" : found.getFirst().toString();
    }

    @Test
    void punchingOnAHolidayAsksTheManager() throws Exception {
        jdbc.update("insert into holiday (id, holiday_date, name, is_tentative) values ('HD-TEST', '2026-11-12', 'Test holiday', false)");

        as("OPR-0018").post("/api/attendance/punch", "{\"mode\":\"home\"}");

        assertThat(JsonPath.<List<String>>read(vikram.get("/api/team/comp-offs?status=pending").body(), "$[*].employeeName")).containsExactly("Arjun Reddy");
        assertThat(JsonPath.<List<String>>read(vikram.get("/api/notifications").body(), "$[*].text"))
                .contains("Arjun Reddy is working on Thursday 12 November, a day off. Give them compensatory off from Leave requests.");
    }

    @Test
    void anOrdinaryDayAsksNothing() throws Exception {
        as("OPR-0018").post("/api/attendance/punch", "{\"mode\":\"home\"}");

        assertThat(JsonPath.<List<String>>read(vikram.get("/api/team/comp-offs").body(), "$")).isEmpty();
    }

    @Test
    void aFullDayWorkedEarnsADay() throws Exception {
        workedFriday("09:00", "15:00");
        assertThat(JsonPath.<Number>read(vikram.get("/api/team/comp-offs").body(), "$[0].workedMinutes").intValue()).isEqualTo(360);

        String decided = vikram.post("/api/team/comp-offs/CO-TEST/decision", "{\"decision\":\"approved\"}").body();

        ApiClient arjun = as("OPR-0018");
        assertThat(JsonPath.<Number>read(decided, "$.days").doubleValue()).isEqualTo(1.0);
        assertThat(compOff(arjun)).isEqualTo("1.0");
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/notifications").body(), "$[*].text"))
                .contains("Vikram Singh approved 1 day of compensatory off for working on Friday 6 November. Take it by Friday 20 November, or it's gone.");
    }

    @Test
    void compensatoryOffIsTakenWithinFourteenDaysOfTheDayWorked() throws Exception {
        workedFriday("09:00", "15:00");
        vikram.post("/api/team/comp-offs/CO-TEST/decision", "{\"decision\":\"approved\"}");
        ApiClient arjun = as("OPR-0018");
        String compOff = "{\"type\":\"comp-off\",\"from\":\"%s\",\"to\":\"%s\",\"reason\":\"Rest\"}";

        assertThat(JsonPath.<List<String>>read(arjun.get("/api/leave/balances").body(), "$[?(@.type == 'comp-off')].expiresOn")).containsExactly("2026-11-20");
        assertThat(arjun.post("/api/leave/requests", compOff.formatted("2026-11-22", "2026-11-22")).body())
                .isEqualTo("{\"message\":\"You don't have enough compensatory off for those dates. It's taken within 14 days of the day worked.\"}");
        assertThat(arjun.post("/api/leave/requests", compOff.formatted("2026-11-15", "2026-11-15")).statusCode()).isEqualTo(200);
        assertThat(JsonPath.<List<Object>>read(arjun.get("/api/leave/balances").body(), "$[?(@.type == 'comp-off')].pending")).containsExactly(1.0);
    }

    @Test
    void unusedCompensatoryOffIsGoneAfterFourteenDays() throws Exception {
        jdbc.update("insert into comp_off_claim (id, employee_id, work_date, status, days) values ('CO-TEST', 'OPR-0018', '2026-10-23', 'approved', 1)");

        assertThat(compOff(as("OPR-0018"))).isEqualTo("none");
    }

    @Test
    void aShortDayEarnsHalf() throws Exception {
        workedFriday("09:00", "11:00");

        vikram.post("/api/team/comp-offs/CO-TEST/decision", "{\"decision\":\"approved\"}");

        assertThat(compOff(as("OPR-0018"))).isEqualTo("0.5");
    }

    @Test
    void waitsUntilTheyHavePunchedOut() throws Exception {
        workedFriday("09:00");

        assertThat(vikram.post("/api/team/comp-offs/CO-TEST/decision", "{\"decision\":\"approved\"}").body())
                .isEqualTo("{\"message\":\"They haven't punched out that day yet. Approve it once they have, or fix their punches.\"}");
    }

    @Test
    void decliningNeedsAReasonAndEarnsNothing() throws Exception {
        workedFriday("09:00", "15:00");

        assertThat(vikram.post("/api/team/comp-offs/CO-TEST/decision", "{\"decision\":\"rejected\"}").statusCode()).isEqualTo(400);
        vikram.post("/api/team/comp-offs/CO-TEST/decision", "{\"decision\":\"rejected\",\"note\":\"Nobody asked you to come in\"}");

        assertThat(compOff(as("OPR-0018"))).isEqualTo("none");
    }

    @Test
    void onlyTheirManagerDecides() throws Exception {
        workedFriday("09:00", "15:00");

        assertThat(as("OPR-0001").post("/api/team/comp-offs/CO-TEST/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(404);
        assertThat(as("OPR-0002").post("/api/hr/comp-offs/CO-TEST/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(404);
        assertThat(JsonPath.<String>read(vikram.post("/api/team/comp-offs/CO-TEST/decision", "{\"decision\":\"approved\"}").body(), "$.status"))
                .isEqualTo("approved");
    }

    @Test
    void aSuperAdminHasNobodyToAskSoEarnsNone() throws Exception {
        jdbc.update("insert into holiday (id, holiday_date, name, is_tentative) values ('HD-TEST', '2026-11-12', 'Test holiday', false)");

        as("OPR-0001").post("/api/attendance/punch", "{\"mode\":\"home\"}");

        assertThat(jdbc.queryForObject("select count(*) from comp_off_claim", Integer.class)).isZero();
    }
}
