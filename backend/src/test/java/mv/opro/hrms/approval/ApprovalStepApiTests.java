package mv.opro.hrms.approval;

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

// Vikram (OPR-0004) is the HOD of Sneha (OPR-0011), Priya (OPR-0015), Arjun (OPR-0018) and Rohit (OPR-0021).
// Ananya (OPR-0002) is HR and reports to Rajesh (OPR-0001), a super admin. Today is Thursday 12 November 2026.
@ApiTest
class ApprovalStepApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient vikram;
    ApiClient ananya;

    @BeforeEach
    void signIn() throws Exception {
        vikram = as("OPR-0004");
        ananya = as("OPR-0002");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("update leave_type set needs_hr_approval = false");
        jdbc.update("update approval_rule set needs_hr = false");
        jdbc.update("update employee set is_hr = false where id = 'OPR-0004'");
        jdbc.update("update leave_request set status = 'pending', decided_by = null, decided_on = null, decision_note = null, hod_approved_by = null,"
                + " hod_approved_on = null where id in ('LR-1042', 'LR-1043', 'LR-1044')");
        jdbc.update("delete from leave_request where id = 'LR-TEST'");
        jdbc.update("update overtime_claim set status = 'pending', minutes = null, decided_by = null, decided_on = null, decision_note = null,"
                + " hod_approved_by = null, hod_approved_on = null");
        jdbc.update("delete from notification where id > ?", SEEDED_NOTIFICATIONS);
    }

    private ApiClient as(String employeeId) throws Exception {
        ApiClient client = new ApiClient(port);
        client.signIn(employeeId);
        return client;
    }

    private List<String> notificationsOf(ApiClient client) throws Exception {
        return JsonPath.read(client.get("/api/notifications").body(), "$[*].text");
    }

    private String status(String id) {
        return jdbc.queryForObject("select status from leave_request where id = ?", String.class, id);
    }

    @Test
    void hrSetsWhichRequestsNeedThemAndNobodyElseCan() throws Exception {
        assertThat(ananya.get("/api/hr/approval-rules").body())
                .isEqualTo("{\"punchFixes\":false,\"homeDays\":false,\"compOff\":false,\"overtime\":false}");

        String saved = ananya.put("/api/hr/approval-rules", "{\"punchFixes\":true,\"homeDays\":false,\"compOff\":false,\"overtime\":true}").body();

        assertThat(saved).isEqualTo("{\"punchFixes\":true,\"homeDays\":false,\"compOff\":false,\"overtime\":true}");
        assertThat(vikram.put("/api/hr/approval-rules", "{\"punchFixes\":true,\"homeDays\":true,\"compOff\":true,\"overtime\":true}").statusCode())
                .isEqualTo(403);
        assertThat(vikram.get("/api/hr/approvals").statusCode()).isEqualTo(403);
    }

    @Test
    void aLeaveTypeCanAskForHrAfterTheHod() throws Exception {
        String body = """
                {"name":"Annual leave","allowsHalfDay":true,"isUnlimited":false,"defaultEntitlement":30,"isForEveryone":true,
                 "carriesForward":false,"needsHrApproval":true}""";

        String saved = ananya.put("/api/hr/leave-types/annual", body).body();

        assertThat(JsonPath.<Boolean>read(saved, "$.needsHrApproval")).isTrue();
    }

    @Test
    void theHodsApprovalPassesItToHrWhoDecideIt() throws Exception {
        jdbc.update("update leave_type set needs_hr_approval = true where code = 'annual'");

        String passed = vikram.post("/api/team/leave-requests/LR-1043/decision", "{\"decision\":\"approved\"}").body();

        assertThat(JsonPath.<String>read(passed, "$.status")).isEqualTo("pending");
        assertThat(JsonPath.<String>read(passed, "$.hodApprovedOn")).isEqualTo("2026-11-12");
        ApiClient priya = as("OPR-0015");
        assertThat(notificationsOf(priya)).contains("Vikram Singh approved your annual leave for Sunday 20 December to Thursday 31 December. It now waits for HR.");
        assertThat(notificationsOf(ananya)).contains("Vikram Singh approved Priya Nair's annual leave for Sunday 20 December to Thursday 31 December."
                + " It needs HR too. Decide it from Inbox.");
        assertThat(vikram.post("/api/team/leave-requests/LR-1043/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(409);

        String waiting = ananya.get("/api/hr/approvals").body();
        assertThat(JsonPath.<List<String>>read(waiting, "$.leave[*].id")).containsExactly("LR-1043");
        assertThat(JsonPath.<String>read(waiting, "$.leave[0].hodApprovedByName")).isEqualTo("Vikram Singh");

        assertThat(ananya.post("/api/hr/approvals/leave/LR-1043/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(200);
        assertThat(status("LR-1043")).isEqualTo("approved");
        assertThat(notificationsOf(priya)).contains("Your annual leave for Sunday 20 December to Thursday 31 December was approved.");
    }

    @Test
    void typesWithoutTheStepAreDecidedByTheHodAlone() throws Exception {
        vikram.post("/api/team/leave-requests/LR-1043/decision", "{\"decision\":\"approved\"}");

        assertThat(status("LR-1043")).isEqualTo("approved");
        assertThat(JsonPath.<List<Object>>read(ananya.get("/api/hr/approvals").body(), "$.leave")).isEmpty();
    }

    @Test
    void anHodWhoIsHrCoversBothSteps() throws Exception {
        jdbc.update("update leave_type set needs_hr_approval = true where code = 'annual'");
        jdbc.update("update employee set is_hr = true where id = 'OPR-0004'");

        vikram.post("/api/team/leave-requests/LR-1043/decision", "{\"decision\":\"approved\"}");

        assertThat(status("LR-1043")).isEqualTo("approved");
    }

    @Test
    void decliningAtEitherStepEndsIt() throws Exception {
        jdbc.update("update leave_type set needs_hr_approval = true where code in ('annual', 'family')");

        vikram.post("/api/team/leave-requests/LR-1042/decision", "{\"decision\":\"rejected\",\"note\":\"Audit week\"}");
        vikram.post("/api/team/leave-requests/LR-1044/decision", "{\"decision\":\"approved\"}");

        assertThat(status("LR-1042")).isEqualTo("rejected");
        assertThat(ananya.post("/api/hr/approvals/leave/LR-1044/decision", "{\"decision\":\"rejected\"}").statusCode()).isEqualTo(400);
        ananya.post("/api/hr/approvals/leave/LR-1044/decision", "{\"decision\":\"rejected\",\"note\":\"Two people are already off that day\"}");
        assertThat(status("LR-1044")).isEqualTo("rejected");
        assertThat(notificationsOf(as("OPR-0021"))).contains("Your family responsibility leave for Wednesday 18 November was declined: Two people are already off that day.");
    }

    @Test
    void overtimeCanWaitForHrToo() throws Exception {
        jdbc.update("insert into punch (employee_id, punched_at, source, work_mode, office) values ('OPR-0018', '2026-11-09T08:50:00+05:00', 'app', 'office',"
                + " 'Malé office'), ('OPR-0018', '2026-11-09T18:20:00+05:00', 'app', 'office', 'Malé office') on conflict do nothing");
        ananya.put("/api/hr/approval-rules", "{\"punchFixes\":false,\"homeDays\":false,\"compOff\":false,\"overtime\":true}");

        vikram.post("/api/team/overtime/OT-1/decision", "{\"decision\":\"approved\"}");

        assertThat(JsonPath.<List<String>>read(ananya.get("/api/hr/approvals").body(), "$.overtime[*].id")).containsExactly("OT-1");
        ananya.post("/api/hr/approvals/overtime/OT-1/decision", "{\"decision\":\"approved\"}");
        assertThat(jdbc.queryForObject("select minutes from overtime_claim where id = 'OT-1'", Integer.class)).isEqualTo(80);
    }

    @Test
    void superAdminsStepInOnTheHodStepOnly() throws Exception {
        jdbc.update("update leave_type set needs_hr_approval = true where code = 'annual'");
        ApiClient rajesh = as("OPR-0001");

        rajesh.post("/api/company/leave-requests/LR-1042/decision", "{\"decision\":\"approved\"}");

        assertThat(status("LR-1042")).isEqualTo("pending");
        assertThat(rajesh.post("/api/company/leave-requests/LR-1042/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(409);
    }

    @Test
    void hrNeverDecidesTheirOwn() throws Exception {
        jdbc.update("insert into leave_request (id, employee_id, type, from_date, to_date, days, reason, status, applied_on, hod_approved_by, hod_approved_on)"
                + " values ('LR-TEST', 'OPR-0002', 'annual', '2026-12-14', '2026-12-14', 1, 'Errand', 'pending', '2026-11-12', 'OPR-0001', '2026-11-12')");

        assertThat(JsonPath.<List<Object>>read(ananya.get("/api/hr/approvals").body(), "$.leave")).isEmpty();
        assertThat(ananya.post("/api/hr/approvals/leave/LR-TEST/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(403);
        assertThat(ananya.post("/api/hr/approvals/leave/LR-1042/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(404);
    }
}
