package mv.opro.hrms.exit;

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

// Arjun (OPR-0018) reports to Vikram (OPR-0004). Ananya (OPR-0002) is HR, Rajesh (OPR-0001) a super admin with no HOD.
// Today is Thursday 12 November 2026.
@ApiTest
class ExitApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;
    private static final String RESIGN = "{\"reason\":\"Moving back home\",\"releaseOn\":\"2026-12-31\"}";

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient arjun;
    ApiClient vikram;
    ApiClient ananya;

    @BeforeEach
    void signIn() throws Exception {
        arjun = as("OPR-0018");
        vikram = as("OPR-0004");
        ananya = as("OPR-0002");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from exit_return");
        jdbc.update("delete from resignation");
        jdbc.update("delete from exit_item where id not in ('EI-1', 'EI-2', 'EI-3', 'EI-4')");
        jdbc.update("update employee set last_day = null, leaving_reason = null where id = 'OPR-0018'");
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

    // Arjun resigns and Vikram approves, so it waits for HR. Returns its id.
    private String resignedAndApprovedByHod() throws Exception {
        String id = JsonPath.read(arjun.post("/api/resignation", RESIGN).body(), "$.id");
        vikram.post("/api/team/resignations/" + id + "/decision", "{\"decision\":\"approved\"}");
        return id;
    }

    @Test
    void resigningTellsTheHodAndOnlyOneCanBeOpen() throws Exception {
        HttpResponse<String> resigned = arjun.post("/api/resignation", RESIGN);

        assertThat(JsonPath.<String>read(resigned.body(), "$.status")).isEqualTo("pending");
        assertThat(JsonPath.<String>read(resigned.body(), "$.submittedOn")).isEqualTo("2026-11-12");
        assertThat(notificationsOf(vikram)).contains("Arjun Reddy resigned, asking for Thursday 31 December as their last day. Decide it from Leave requests.");
        assertThat(arjun.post("/api/resignation", RESIGN).statusCode()).isEqualTo(409);
        assertThat(as("OPR-0015").post("/api/resignation", "{\"reason\":\"New job\",\"releaseOn\":\"2026-11-12\"}").body())
                .isEqualTo("{\"message\":\"Pick a last day after today.\"}");
    }

    @Test
    void theHodApprovesThenItWaitsForHr() throws Exception {
        String id = JsonPath.read(arjun.post("/api/resignation", RESIGN).body(), "$.id");
        String decision = "/api/team/resignations/" + id + "/decision";

        assertThat(vikram.post(decision, "{\"decision\":\"rejected\"}").statusCode()).isEqualTo(400);
        String approved = vikram.post(decision, "{\"decision\":\"approved\"}").body();

        assertThat(JsonPath.<String>read(approved, "$.status")).isEqualTo("pending");
        assertThat(JsonPath.<String>read(approved, "$.hodApprovedByName")).isEqualTo("Vikram Singh");
        assertThat(vikram.post(decision, "{\"decision\":\"approved\"}").body()).isEqualTo("{\"message\":\"Their HOD approved this. It now waits for HR.\"}");
        assertThat(notificationsOf(arjun)).contains("Vikram Singh approved your resignation. It now waits for HR.");
        assertThat(JsonPath.<List<String>>read(ananya.get("/api/hr/resignations").body(), "$[*].id")).containsExactly(id);
        assertThat(as("OPR-0015").post(decision, "{\"decision\":\"approved\"}").statusCode()).isEqualTo(403);
    }

    @Test
    void hrSetsTheExitDateAndTheyHearWhatToReturn() throws Exception {
        String id = resignedAndApprovedByHod();

        String accepted = ananya.post("/api/hr/resignations/" + id + "/decision", "{\"decision\":\"approved\",\"exitOn\":\"2027-01-07\"}").body();

        assertThat(JsonPath.<String>read(accepted, "$.status")).isEqualTo("approved");
        assertThat(JsonPath.<String>read(accepted, "$.exitOn")).isEqualTo("2027-01-07");
        assertThat(notificationsOf(arjun)).contains(
                "Your resignation was accepted. Your exit date is 7 January 2027. Before you go, return your laptop, id card, bus travel card, accommodation keys to HR.");
        assertThat(notificationsOf(vikram)).contains("Arjun Reddy's exit date is 7 January 2027.");
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/resignation").body(), "$[0].checklist[*].name"))
                .containsExactly("Laptop", "ID card", "Bus travel card", "Accommodation keys");
        assertThat(JsonPath.<String>read(ananya.get("/api/hr/employees/OPR-0018/exit").body(), "$.exitOn")).isEqualTo("2027-01-07");
        assertThat(ananya.get("/api/hr/employees/OPR-0015/exit").statusCode()).isEqualTo(204);
    }

    @Test
    void leavingWaitsUntilEverythingIsTickedOff() throws Exception {
        String id = resignedAndApprovedByHod();
        ananya.post("/api/hr/resignations/" + id + "/decision", "{\"decision\":\"approved\"}");
        String leaving = "{\"lastDay\":\"2026-12-31\",\"reason\":\"Resigned\"}";

        HttpResponse<String> locked = ananya.post("/api/hr/employees/OPR-0018/leaving", leaving);
        assertThat(locked.statusCode()).isEqualTo(409);
        assertThat(locked.body()).isEqualTo("{\"message\":\"Tick off what they still have first: laptop, id card, bus travel card, accommodation keys.\"}");

        ananya.put("/api/hr/employees/OPR-0018/exit/items/EI-1", "{\"outcome\":\"returned\"}");
        ananya.put("/api/hr/employees/OPR-0018/exit/items/EI-2", "{\"outcome\":\"returned\"}");
        ananya.put("/api/hr/employees/OPR-0018/exit/items/EI-3", "{\"outcome\":\"not-given\"}");
        String checklist = ananya.put("/api/hr/employees/OPR-0018/exit/items/EI-4", "{\"outcome\":\"returned\"}").body();
        assertThat(JsonPath.<List<String>>read(checklist, "$.checklist[*].outcome")).containsExactly("returned", "returned", "not-given", "returned");

        assertThat(ananya.post("/api/hr/employees/OPR-0018/leaving", leaving).statusCode()).isEqualTo(200);
    }

    @Test
    void hrDeclinesWithAReasonAndNeverDecidesTheirOwn() throws Exception {
        String id = resignedAndApprovedByHod();

        assertThat(ananya.post("/api/hr/resignations/" + id + "/decision", "{\"decision\":\"rejected\"}").statusCode()).isEqualTo(400);
        ananya.post("/api/hr/resignations/" + id + "/decision", "{\"decision\":\"rejected\",\"note\":\"Your contract runs to January\"}");
        assertThat(notificationsOf(arjun))
                .contains("Ananya Iyer didn't accept your resignation: Your contract runs to January. Talk to them about what happens next.");

        String own = JsonPath.read(ananya.post("/api/resignation", RESIGN).body(), "$.id");
        as("OPR-0001").post("/api/team/resignations/" + own + "/decision", "{\"decision\":\"approved\"}");
        assertThat(ananya.post("/api/hr/resignations/" + own + "/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(403);
        assertThat(JsonPath.<List<String>>read(ananya.get("/api/hr/resignations").body(), "$[*].id")).doesNotContain(own);
    }

    @Test
    void aWaitingResignationCanBeWithdrawnButNotADecidedOne() throws Exception {
        String id = JsonPath.read(arjun.post("/api/resignation", RESIGN).body(), "$.id");

        assertThat(JsonPath.<String>read(arjun.post("/api/resignation/" + id + "/withdraw", "{}").body(), "$.status")).isEqualTo("withdrawn");
        assertThat(arjun.post("/api/resignation/" + id + "/withdraw", "{}").statusCode()).isEqualTo(409);
        assertThat(as("OPR-0015").post("/api/resignation/" + id + "/withdraw", "{}").statusCode()).isEqualTo(404);
    }

    @Test
    void aSuperAdminWithNoHodGoesStraightToHr() throws Exception {
        String id = JsonPath.read(as("OPR-0001").post("/api/resignation", RESIGN).body(), "$.id");

        assertThat(JsonPath.<List<String>>read(ananya.get("/api/hr/resignations").body(), "$[*].id")).containsExactly(id);
        assertThat(notificationsOf(ananya)).contains("Rajesh Sharma resigned, asking for Thursday 31 December as their last day. Decide it from Inbox.");
    }

    @Test
    void hrKeepsTheListOfWhatComesBack() throws Exception {
        String added = ananya.post("/api/hr/exit-items", "{\"name\":\"Parking pass\"}").body();
        assertThat(ananya.post("/api/hr/exit-items", "{\"name\":\"parking pass\"}").statusCode()).isEqualTo(409);
        assertThat(JsonPath.<List<String>>read(ananya.get("/api/hr/exit-items").body(), "$[*].name")).endsWith("Parking pass");

        assertThat(ananya.delete("/api/hr/exit-items/" + JsonPath.read(added, "$.id")).statusCode()).isEqualTo(204);
        assertThat(arjun.get("/api/hr/exit-items").statusCode()).isEqualTo(403);
    }
}
