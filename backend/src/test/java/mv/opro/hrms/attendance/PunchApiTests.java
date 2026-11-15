package mv.opro.hrms.attendance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.net.http.HttpResponse;
import java.util.List;
import mv.opro.hrms.ApiClient;
import mv.opro.hrms.ApiTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

// It's 10:30 on Thursday 12 November 2026. Kasun (OPR-0018) reports to Ibrahim (OPR-0004). The Malé office pin is 4.1755, 73.5093.
@ApiTest
class PunchApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;
    private static final String AT_THE_OFFICE = "{\"mode\":\"office\",\"latitude\":4.1760,\"longitude\":73.5095,\"accuracy\":20}";
    private static final String FROM_HOME = "{\"mode\":\"home\"}";

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient kasun;

    @BeforeEach
    void signIn() throws Exception {
        kasun = as("OPR-0018");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from punch");
        jdbc.update("delete from home_day");
        jdbc.update("delete from notification where id > ?", SEEDED_NOTIFICATIONS);
    }

    private ApiClient as(String employeeId) throws Exception {
        ApiClient client = new ApiClient(port);
        client.signIn(employeeId);
        return client;
    }

    private void punchedFromHomeAt(String time) {
        jdbc.update("insert into punch (employee_id, punched_at, source, work_mode) values ('OPR-0018', ?::timestamptz, 'app', 'home')",
                "2026-11-12T" + time + ":00+05:00");
        jdbc.update("insert into home_day (id, employee_id, work_date) values ('HW-TEST', 'OPR-0018', '2026-11-12') on conflict do nothing");
    }

    @Test
    void punchesInAtTheOfficeAndSaysWhichOne() throws Exception {
        HttpResponse<String> response = kasun.post("/api/attendance/punch", AT_THE_OFFICE);

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<String>read(response.body(), "$.status")).isEqualTo("late");
        assertThat(JsonPath.<String>read(response.body(), "$.workMode")).isEqualTo("office");
        assertThat(JsonPath.<String>read(response.body(), "$.punches[0].device")).isEqualTo("Malé office");
        assertThat(jdbc.queryForObject("select distance_metres from punch", Integer.class)).isBetween(55, 65);
    }

    @Test
    void refusesTheOfficeFromTooFarAway() throws Exception {
        HttpResponse<String> response = kasun.post("/api/attendance/punch", "{\"mode\":\"office\",\"latitude\":4.1900,\"longitude\":73.5093,\"accuracy\":20}");

        assertThat(response.statusCode()).isEqualTo(409);
        assertThat(response.body()).isEqualTo("{\"message\":\"You're 1.6 km from Malé office. Punch in from the office, or choose working from home.\"}");
        assertThat(jdbc.queryForObject("select count(*) from punch", Integer.class)).isZero();
    }

    @Test
    void theOfficeNeedsAPreciseLocation() throws Exception {
        assertThat(kasun.post("/api/attendance/punch", "{\"mode\":\"office\"}").body())
                .isEqualTo("{\"message\":\"Allow location so we can see you're at the office.\"}");
        assertThat(kasun.post("/api/attendance/punch", "{\"mode\":\"office\",\"latitude\":4.1755,\"longitude\":73.5093,\"accuracy\":900}").body())
                .isEqualTo("{\"message\":\"Your location is only accurate to about 900 m, so we can't tell you're at the office. Turn on precise location and try again.\"}");
    }

    @Test
    void anySiteCounts() throws Exception {
        String day = kasun.post("/api/attendance/punch", "{\"mode\":\"office\",\"latitude\":4.2118,\"longitude\":73.5404,\"accuracy\":30}").body();

        assertThat(JsonPath.<String>read(day, "$.punches[0].device")).isEqualTo("Hulhumalé site");
    }

    @Test
    void workingFromHomeNeedsNoLocationAndAsksTheManager() throws Exception {
        String day = kasun.post("/api/attendance/punch", FROM_HOME).body();

        assertThat(JsonPath.<String>read(day, "$.workMode")).isEqualTo("home");
        assertThat(JsonPath.<String>read(day, "$.homeStatus")).isEqualTo("pending");
        assertThat(JsonPath.<String>read(day, "$.punches[0].device")).isEqualTo("Home");
        assertThat(JsonPath.<List<String>>read(as("OPR-0004").get("/api/notifications").body(), "$[*].text"))
                .contains("Kasun Perera is working from home today. Approve it from Leave requests.");
    }

    @Test
    void punchingOutFromHomeShowsTheHoursWorked() throws Exception {
        punchedFromHomeAt("08:50");

        String day = kasun.post("/api/attendance/punch", FROM_HOME).body();

        assertThat(JsonPath.<List<String>>read(day, "$.punches[*].direction")).containsExactly("in", "out");
        assertThat(JsonPath.<Integer>read(day, "$.workedMinutes")).isEqualTo(100);
        assertThat(jdbc.queryForObject("select count(*) from home_day", Integer.class)).isEqualTo(1);
    }

    @Test
    void aDayIsWorkedOneWay() throws Exception {
        punchedFromHomeAt("08:50");

        HttpResponse<String> response = kasun.post("/api/attendance/punch", AT_THE_OFFICE);

        assertThat(response.statusCode()).isEqualTo(409);
        assertThat(response.body()).isEqualTo("{\"message\":\"You started today working from home. Punch out the same way.\"}");
    }

    @Test
    void aDoubleTapLandsOnce() throws Exception {
        kasun.post("/api/attendance/punch", FROM_HOME);

        HttpResponse<String> again = kasun.post("/api/attendance/punch", FROM_HOME);

        assertThat(again.statusCode()).isEqualTo(409);
        assertThat(jdbc.queryForObject("select count(*) from punch", Integer.class)).isEqualTo(1);
    }

    @Test
    void refusesAModeThatDoesNotExist() throws Exception {
        assertThat(kasun.post("/api/attendance/punch", "{\"mode\":\"beach\"}").statusCode()).isEqualTo(400);
    }

    @Test
    void theManagerDeclinesWithAReasonAndTheDayBecomesAnAbsence() throws Exception {
        punchedFromHomeAt("08:50");
        ApiClient ibrahim = as("OPR-0004");
        assertThat(JsonPath.<List<String>>read(ibrahim.get("/api/team/home-days?status=pending").body(), "$[*].employeeName")).containsExactly("Kasun Perera");

        assertThat(ibrahim.post("/api/team/home-days/HW-TEST/decision", "{\"decision\":\"rejected\"}").statusCode()).isEqualTo(400);
        String decided = ibrahim.post("/api/team/home-days/HW-TEST/decision", "{\"decision\":\"rejected\",\"note\":\"We had the site visit today\"}").body();

        assertThat(JsonPath.<String>read(decided, "$.decidedByName")).isEqualTo("Ibrahim Rasheed");
        String today = kasun.get("/api/attendance?month=2026-11").body();
        assertThat(JsonPath.<List<String>>read(today, "$[?(@.date == '2026-11-12')].status")).containsExactly("absent");
        assertThat(JsonPath.<List<String>>read(kasun.get("/api/notifications").body(), "$[*].text"))
                .contains("Ibrahim Rasheed didn't approve working from home on Thursday 12 November, so it counts as absent: We had the site visit today.");
    }

    @Test
    void onlyTheirManagerOrHrDecides() throws Exception {
        punchedFromHomeAt("08:50");

        assertThat(as("OPR-0001").post("/api/team/home-days/HW-TEST/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(404);
        String approved = as("OPR-0002").post("/api/hr/home-days/HW-TEST/decision", "{\"decision\":\"approved\"}").body();

        assertThat(JsonPath.<String>read(approved, "$.status")).isEqualTo("approved");
        assertThat(as("OPR-0004").post("/api/team/home-days/HW-TEST/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(409);
        assertThat(JsonPath.<List<String>>read(kasun.get("/api/notifications").body(), "$[*].text"))
                .contains("Aishath Shifa approved working from home on Thursday 12 November.");
    }
}
