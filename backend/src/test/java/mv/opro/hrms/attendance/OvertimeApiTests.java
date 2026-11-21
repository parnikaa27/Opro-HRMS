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

// Arjun (OPR-0018) and Rohit (OPR-0021) report to Vikram (OPR-0004). The dev seed has Arjun working 08:50 to 18:20 on
// Monday 9 November (1h 20m past the shift) and Rohit 08:58 to 18:05 on Sunday 8 November. Today is Thursday 12 November.
@ApiTest
class OvertimeApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient vikram;

    @BeforeEach
    void setUp() throws Exception {
        // Other tests clear every punch, so put the seeded days back.
        punch("OPR-0018", "2026-11-09T08:50", "2026-11-09T18:20");
        punch("OPR-0021", "2026-11-08T08:58", "2026-11-08T18:05");
        vikram = as("OPR-0004");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("update overtime_claim set status = 'pending', minutes = null, decided_by = null, decided_on = null, decision_note = null");
        jdbc.update("delete from overtime_claim where id not in ('OT-1', 'OT-2')");
        jdbc.update("delete from punch where punched_at::date = '2026-11-10'");
        jdbc.update("delete from correction_request where length(id) > 6");
        jdbc.update("delete from notification where id > ?", SEEDED_NOTIFICATIONS);
    }

    private ApiClient as(String employeeId) throws Exception {
        ApiClient client = new ApiClient(port);
        client.signIn(employeeId);
        return client;
    }

    private void punch(String employeeId, String... times) {
        for (String time : times) {
            jdbc.update("insert into punch (employee_id, punched_at, source, work_mode, office) values (?, ?::timestamptz, 'app', 'office', 'Malé office')"
                    + " on conflict do nothing", employeeId, time + ":00+05:00");
        }
    }

    private List<String> notificationsOf(ApiClient client) throws Exception {
        return JsonPath.read(client.get("/api/notifications").body(), "$[*].text");
    }

    @Test
    void theHodSeesWhatEachDayShowsPastTheShift() throws Exception {
        String waiting = vikram.get("/api/team/overtime?status=pending").body();

        assertThat(JsonPath.<List<String>>read(waiting, "$[*].employeeName")).containsExactly("Arjun Reddy", "Rohit Verma");
        assertThat(JsonPath.<List<Integer>>read(waiting, "$[*].minutes")).containsExactly(80, 65);
    }

    @Test
    void someoneSeesTheirOwnOvertimeAndWhereItStands() throws Exception {
        String mine = as("OPR-0018").get("/api/attendance/overtime").body();

        assertThat(JsonPath.<List<String>>read(mine, "$[*].id")).containsExactly("OT-1");
        assertThat(JsonPath.<List<String>>read(mine, "$[*].status")).containsExactly("pending");
    }

    @Test
    void theAttendanceLogShowsOvertime() throws Exception {
        String november = as("OPR-0018").get("/api/attendance?month=2026-11").body();

        assertThat(JsonPath.<List<Integer>>read(november, "$[?(@.date == '2026-11-09')].overtimeMinutes")).containsExactly(80);
    }

    @Test
    void approvingKeepsTheMinutesAndTellsThem() throws Exception {
        String decided = vikram.post("/api/team/overtime/OT-1/decision", "{\"decision\":\"approved\"}").body();

        assertThat(JsonPath.<String>read(decided, "$.status")).isEqualTo("approved");
        assertThat(JsonPath.<String>read(decided, "$.decidedByName")).isEqualTo("Vikram Singh");
        assertThat(jdbc.queryForObject("select minutes from overtime_claim where id = 'OT-1'", Integer.class)).isEqualTo(80);
        assertThat(notificationsOf(as("OPR-0018"))).contains("Vikram Singh approved 1h 20m of overtime on Monday 9 November.");
    }

    @Test
    void decliningNeedsAReason() throws Exception {
        assertThat(vikram.post("/api/team/overtime/OT-2/decision", "{\"decision\":\"rejected\"}").statusCode()).isEqualTo(400);

        vikram.post("/api/team/overtime/OT-2/decision", "{\"decision\":\"rejected\",\"note\":\"The delivery was moved to the next day\"}");

        assertThat(jdbc.queryForObject("select minutes from overtime_claim where id = 'OT-2'", Integer.class)).isNull();
        assertThat(notificationsOf(as("OPR-0021"))).contains("Vikram Singh didn't approve overtime on Sunday 8 November: The delivery was moved to the next day.");
        assertThat(vikram.post("/api/team/overtime/OT-2/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(409);
    }

    @Test
    void aDayThatNoLongerShowsOvertimeCannotBeApproved() throws Exception {
        jdbc.update("delete from punch where employee_id = 'OPR-0018' and punched_at::date = '2026-11-09'");
        punch("OPR-0018", "2026-11-09T09:00", "2026-11-09T17:10");

        assertThat(vikram.post("/api/team/overtime/OT-1/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(409);
        jdbc.update("delete from punch where employee_id = 'OPR-0018' and punched_at::date = '2026-11-09'");
    }

    @Test
    void aPunchFixThatEndsTheDayLateAsksTheHod() throws Exception {
        punch("OPR-0018", "2026-11-10T08:55");
        String fix = JsonPath.read(as("OPR-0018").post("/api/attendance/corrections",
                "{\"date\":\"2026-11-10\",\"kind\":\"missed-out\",\"category\":\"forgot\",\"requestedTime\":\"18:00\"}").body(), "$.id");

        vikram.post("/api/team/corrections/" + fix + "/decision", "{\"decision\":\"approved\"}");

        assertThat(JsonPath.<List<Integer>>read(vikram.get("/api/team/overtime").body(), "$[?(@.date == '2026-11-10')].minutes")).containsExactly(60);
        assertThat(notificationsOf(vikram)).contains("Arjun Reddy worked 1h past the shift on Tuesday 10 November. Approve the overtime from Leave requests.");
    }

    @Test
    void onlyTheirHodOrASuperAdminDecides() throws Exception {
        assertThat(as("OPR-0018").post("/api/team/overtime/OT-2/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(403);
        assertThat(as("OPR-0001").post("/api/team/overtime/OT-2/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(404);

        String decided = as("OPR-0001").post("/api/company/overtime/OT-2/decision", "{\"decision\":\"approved\"}").body();

        assertThat(JsonPath.<String>read(decided, "$.decidedByName")).isNotBlank();
        assertThat(JsonPath.<Integer>read(decided, "$.minutes")).isEqualTo(65);
    }
}
