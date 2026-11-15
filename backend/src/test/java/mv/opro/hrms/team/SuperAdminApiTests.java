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

// Rajesh (OPR-0001) is the super admin: he reads everyone, steps in on any decision, and needs nobody's approval himself.
@ApiTest
class SuperAdminApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient rajesh;

    @BeforeEach
    void signIn() throws Exception {
        rajesh = as("OPR-0001");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from punch");
        jdbc.update("delete from home_day");
        jdbc.update("delete from leave_request where length(id) > 7");
        jdbc.update("delete from correction_request where length(id) > 6");
        jdbc.update("update leave_request set status = 'pending', decided_by = null, decided_on = null, decision_note = null where id in ('LR-1042', 'LR-1043')");
        jdbc.update("update correction_request set status = 'pending', decided_by = null, decided_on = null, decision_note = null where id = 'AC-301'");
        jdbc.update("delete from notification where id > ?", SEEDED_NOTIFICATIONS);
    }

    private ApiClient as(String employeeId) throws Exception {
        ApiClient client = new ApiClient(port);
        client.signIn(employeeId);
        return client;
    }

    @Test
    void readsEveryoneTheirDayAndTheirHistory() throws Exception {
        jdbc.update("insert into punch (employee_id, punched_at, source, work_mode, office) values ('OPR-0018', '2026-11-12T08:50:00+05:00', 'app', 'resort', 'Client resort')");

        String everyone = rajesh.get("/api/company").body();

        assertThat(JsonPath.<List<String>>read(everyone, "$[*].id")).hasSize(9).contains("OPR-0001", "OPR-0002", "OPR-0018");
        assertThat(JsonPath.<List<String>>read(everyone, "$[?(@.id == 'OPR-0018')].today.workMode")).containsExactly("resort");
        assertThat(JsonPath.<String>read(rajesh.get("/api/company/OPR-0021").body(), "$.fullName")).isEqualTo("Rohit Verma");
        assertThat(JsonPath.<List<String>>read(rajesh.get("/api/company/attendance?month=2026-10").body(), "$[*].employeeId")).contains("OPR-0002", "OPR-0027");
        assertThat(JsonPath.<List<String>>read(rajesh.get("/api/company/leave-requests").body(), "$[*].id")).contains("LR-1042", "LR-1045");
    }

    @Test
    void onlySuperAdminsGetIn() throws Exception {
        HttpResponse<String> hr = as("OPR-0002").get("/api/company");

        assertThat(hr.statusCode()).isEqualTo(403);
        assertThat(hr.body()).isEqualTo("{\"message\":\"Super admins only\"}");
        assertThat(as("OPR-0004").get("/api/company/OPR-0018").statusCode()).isEqualTo(403);
        assertThat(as("OPR-0004").post("/api/company/leave-requests/LR-1042/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(403);
    }

    @Test
    void stepsInForAnHodOnLeaveAndPunchFixes() throws Exception {
        assertThat(JsonPath.<List<String>>read(rajesh.get("/api/company/leave-requests?status=pending").body(), "$[*].id")).contains("LR-1042", "LR-1043");

        String approved = rajesh.post("/api/company/leave-requests/LR-1042/decision", "{\"decision\":\"approved\"}").body();
        String fixed = rajesh.post("/api/company/corrections/AC-301/decision", "{\"decision\":\"approved\"}").body();

        assertThat(JsonPath.<String>read(approved, "$.decidedByName")).isEqualTo("Rajesh Sharma");
        assertThat(JsonPath.<String>read(fixed, "$.status")).isEqualTo("approved");
        assertThat(as("OPR-0004").post("/api/team/leave-requests/LR-1042/decision", "{\"decision\":\"rejected\",\"note\":\"x\"}").statusCode()).isEqualTo(409);
        assertThat(JsonPath.<List<String>>read(as("OPR-0011").get("/api/notifications").body(), "$[*].text"))
                .contains("Your annual leave for Sunday 22 November to Tuesday 24 November was approved.");
    }

    @Test
    void decliningNeedsAReasonAndNeverTheirOwn() throws Exception {
        assertThat(rajesh.post("/api/company/leave-requests/LR-1043/decision", "{\"decision\":\"rejected\"}").statusCode()).isEqualTo(400);
        jdbc.update("insert into leave_request (id, employee_id, type, from_date, to_date, days, reason, status, applied_on) "
                + "values ('LR-OWN-1', 'OPR-0001', 'annual', '2026-12-13', '2026-12-13', 1, 'Before he was a super admin', 'pending', '2026-11-01')");

        assertThat(rajesh.post("/api/company/leave-requests/LR-OWN-1/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(404);
    }

    @Test
    void theirOwnLeaveAndPunchFixesAreApprovedAsTheyAreSent() throws Exception {
        String leave = rajesh.post("/api/leave/requests", "{\"type\":\"annual\",\"from\":\"2026-12-06\",\"to\":\"2026-12-07\",\"reason\":\"Family visit\"}").body();
        String fix = rajesh.post("/api/attendance/corrections", "{\"date\":\"2026-11-10\",\"kind\":\"missed-in\",\"category\":\"forgot\",\"requestedTime\":\"08:55\"}")
                .body();

        assertThat(JsonPath.<String>read(leave, "$.status")).isEqualTo("approved");
        assertThat(JsonPath.<String>read(fix, "$.status")).isEqualTo("approved");
        String month = rajesh.get("/api/attendance?month=2026-11").body();
        assertThat(JsonPath.<List<String>>read(month, "$[?(@.date == '2026-11-10')].punches[0].at")).containsExactly("2026-11-10T08:55:00+05:00");
        assertThat(jdbc.queryForObject("select count(*) from notification where id > ?", Integer.class, SEEDED_NOTIFICATIONS)).isZero();
    }

    @Test
    void workingFromHomeNeedsNoApproval() throws Exception {
        rajesh.post("/api/attendance/punch", "{\"mode\":\"home\"}");

        assertThat(jdbc.queryForObject("select status from home_day where employee_id = 'OPR-0001'", String.class)).isEqualTo("approved");
    }
}
