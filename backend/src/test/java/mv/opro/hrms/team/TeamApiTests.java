package mv.opro.hrms.team;

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

// Ibrahim (OPR-0004) manages six people. Hassan (OPR-0001) manages Ibrahim and Aishath.
@ApiTest
class TeamApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient ibrahim;

    @BeforeEach
    void signIn() throws Exception {
        ibrahim = new ApiClient(port);
        ibrahim.signIn("OPR-0004");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from punch");
        jdbc.update("delete from leave_request where length(id) > 7");
        jdbc.update("update leave_request set status = 'pending', decided_by = null, decided_on = null, decision_note = null where id in ('LR-1042', 'LR-1043', 'LR-1044')");
        jdbc.update("delete from correction_request where length(id) > 6");
        jdbc.update("update correction_request set status = 'pending', decided_by = null, decided_on = null, decision_note = null where id = 'AC-301'");
        jdbc.update("delete from notification where id > ?", SEEDED_NOTIFICATIONS);
    }

    private ApiClient as(String employeeId) throws Exception {
        ApiClient client = new ApiClient(port);
        client.signIn(employeeId);
        return client;
    }

    private List<String> notificationsOf(String employeeId) throws Exception {
        return JsonPath.read(as(employeeId).get("/api/notifications").body(), "$[*].text");
    }

    @Test
    void aManagerSeesTheirReportsWithTodayAndTheirPapers() throws Exception {
        jdbc.update("insert into punch (employee_id, punched_at, device_id, source) values ('OPR-0018', '2026-11-12T09:40:00+05:00', 'OPR-HMH-01', 'device')");

        String team = ibrahim.get("/api/team").body();

        assertThat(JsonPath.<List<String>>read(team, "$[*].fullName"))
                .containsExactly("Ahmed Zahir", "Grace Mendoza", "Kasun Perera", "Mariyam Nisha", "Priya Nair", "Rahim Uddin");
        assertThat(JsonPath.<List<String>>read(team, "$[?(@.id == 'OPR-0018')].today.status")).containsExactly("late");
        assertThat(JsonPath.<List<String>>read(team, "$[?(@.id == 'OPR-0011')].today.status")).containsExactly("not-in-yet");
        assertThat(JsonPath.<List<String>>read(team, "$[?(@.id == 'OPR-0018')].visa.visaExpiry")).containsExactly("2026-12-20");
    }

    @Test
    void someoneWithoutReportsIsNotAManagerHere() throws Exception {
        HttpResponse<String> response = as("OPR-0018").get("/api/team");

        assertThat(response.statusCode()).isEqualTo(403);
        assertThat(response.body()).isEqualTo("{\"message\":\"Managers only\"}");
    }

    @Test
    void oneReportsPageButNeverSomeoneElses() throws Exception {
        String kasun = ibrahim.get("/api/team/OPR-0018").body();

        assertThat(JsonPath.<String>read(kasun, "$.fullName")).isEqualTo("Kasun Perera");
        assertThat(JsonPath.<List<String>>read(kasun, "$.leaveBalances[*].type")).containsExactly("annual", "sick", "family", "paternity");
        assertThat(ibrahim.get("/api/team/OPR-0001").body()).isEqualTo("{\"message\":\"Not one of your reports\"}");
    }

    @Test
    void theTeamsMonthNamesEachPerson() throws Exception {
        String month = ibrahim.get("/api/team/attendance?month=2026-11").body();

        assertThat(JsonPath.<List<String>>read(month, "$[*].employeeName")).hasSize(6 * 12).doesNotContainNull();
        assertThat(JsonPath.<List<String>>read(month, "$[?(@.employeeId == 'OPR-0004')]")).isEmpty();
    }

    @Test
    void waitingLeaveIsTheReportsOnlyNotTheManagersOwn() throws Exception {
        String waiting = ibrahim.get("/api/team/leave-requests?status=pending").body();

        assertThat(JsonPath.<List<String>>read(waiting, "$[*].id")).containsExactlyInAnyOrder("LR-1042", "LR-1043", "LR-1044");
        assertThat(JsonPath.<List<String>>read(waiting, "$[?(@.id == 'LR-1042')].employeeName")).containsExactly("Mariyam Nisha");
    }

    @Test
    void approvingTellsTheEmployeeAndCanOnlyHappenOnce() throws Exception {
        String approved = ibrahim.post("/api/team/leave-requests/LR-1042/decision", "{\"decision\":\"approved\"}").body();

        assertThat(JsonPath.<String>read(approved, "$.status")).isEqualTo("approved");
        assertThat(JsonPath.<String>read(approved, "$.decidedByName")).isEqualTo("Ibrahim Rasheed");
        assertThat(notificationsOf("OPR-0011")).first().isEqualTo("Your annual leave for Sunday 22 November to Tuesday 24 November was approved.");
        HttpResponse<String> again = ibrahim.post("/api/team/leave-requests/LR-1042/decision", "{\"decision\":\"rejected\",\"note\":\"x\"}");
        assertThat(again.statusCode()).isEqualTo(409);
    }

    @Test
    void decliningNeedsAReasonAndPassesItOn() throws Exception {
        HttpResponse<String> bare = ibrahim.post("/api/team/leave-requests/LR-1043/decision", "{\"decision\":\"rejected\"}");
        assertThat(bare.statusCode()).isEqualTo(400);
        assertThat(bare.body()).isEqualTo("{\"message\":\"Give a short reason so they know what to do next.\"}");

        String declined = ibrahim.post("/api/team/leave-requests/LR-1043/decision", "{\"decision\":\"rejected\",\"note\":\"Year end close needs you\"}").body();

        assertThat(JsonPath.<String>read(declined, "$.decisionNote")).isEqualTo("Year end close needs you");
        assertThat(notificationsOf("OPR-0015")).first()
                .isEqualTo("Your annual leave for Sunday 20 December to Thursday 31 December was declined: Year end close needs you.");
    }

    @Test
    void aManagerCantApproveTheirOwnLeaveOrAnotherTeams() throws Exception {
        assertThat(ibrahim.post("/api/team/leave-requests/LR-1045/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(404);
        assertThat(as("OPR-0001").post("/api/team/leave-requests/LR-1042/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(404);
    }

    @Test
    void anApprovedPunchFixLandsOnTheRecordAndTheEmployeeIsTold() throws Exception {
        String approved = ibrahim.post("/api/team/corrections/AC-301/decision", "{\"decision\":\"approved\"}").body();

        assertThat(JsonPath.<String>read(approved, "$.status")).isEqualTo("approved");
        assertThat(jdbc.queryForObject("select correction_request_id from punch where employee_id = 'OPR-0021'", String.class)).isEqualTo("AC-301");
        String rahimsMonth = as("OPR-0021").get("/api/attendance?month=2026-11").body();
        assertThat(JsonPath.<List<Boolean>>read(rahimsMonth, "$[?(@.date == '2026-11-10')].isCorrected")).containsExactly(true);
        assertThat(JsonPath.<List<String>>read(rahimsMonth, "$[?(@.date == '2026-11-10')].punches[0].at")).containsExactly("2026-11-10T17:20:00+05:00");
        assertThat(notificationsOf("OPR-0021")).first()
                .isEqualTo("Your punch fix for Tuesday 10 November was approved. The 5:20 PM punch is now on your record.");
    }

    @Test
    void theManagerHearsAboutNewLeaveAndPunchFixes() throws Exception {
        ApiClient kasun = as("OPR-0018");
        kasun.post("/api/leave/requests", "{\"type\":\"annual\",\"from\":\"2026-12-06\",\"to\":\"2026-12-10\",\"reason\":\"Trip home\"}");
        kasun.post("/api/attendance/corrections", "{\"date\":\"2026-11-10\",\"kind\":\"missed-in\",\"requestedTime\":\"08:55\",\"reason\":\"No reader at the site\"}");

        assertThat(notificationsOf("OPR-0004")).startsWith(
                "Kasun Perera asked for a punch fix on 10 November",
                "Kasun Perera asked for 5 days of annual leave from 6 December");
    }

    @Test
    void notificationsCanAllBeMarkedRead() throws Exception {
        assertThat(JsonPath.<List<Boolean>>read(ibrahim.get("/api/notifications").body(), "$[*].isRead")).contains(false);

        assertThat(ibrahim.post("/api/notifications/read", "{}").statusCode()).isEqualTo(204);

        assertThat(JsonPath.<List<Boolean>>read(ibrahim.get("/api/notifications").body(), "$[*].isRead")).containsOnly(true);
    }

    @Test
    void companyEventsComeByYear() throws Exception {
        assertThat(JsonPath.<List<String>>read(ibrahim.get("/api/events?year=2026").body(), "$[*].name"))
                .containsExactly("Office social", "Team review", "Team review", "Office social", "Year end dinner");
    }
}
