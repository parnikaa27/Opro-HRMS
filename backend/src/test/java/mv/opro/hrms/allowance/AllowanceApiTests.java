package mv.opro.hrms.allowance;

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

// Arjun (OPR-0018) gets MVR 6,000 housing and 1,500 food a month. Rohit (OPR-0021) has a one-off transport grant from
// Vikram (OPR-0004), their HOD, waiting for HR. Ananya (OPR-0002) is HR. Today is 12 November 2026.
@ApiTest
class AllowanceApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;

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
        jdbc.update("delete from monthly_allowance where id not in ('MA-1', 'MA-2', 'MA-3')");
        jdbc.update("update monthly_allowance set ends_on = null");
        jdbc.update("delete from allowance_grant where id <> 'AG-1'");
        jdbc.update("update allowance_grant set status = 'pending', decided_by = null, decided_on = null, decision_note = null");
        jdbc.update("delete from allowance_type where code not in ('housing', 'food', 'transport', 'phone')");
        jdbc.update("update allowance_type set retired_on = null");
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

    @Test
    void someoneSeesTheirOwnAllowances() throws Exception {
        String mine = arjun.get("/api/allowances").body();

        assertThat(JsonPath.<List<String>>read(mine, "$.monthly[*].typeName")).containsExactlyInAnyOrder("Housing", "Food");
        assertThat(JsonPath.<List<String>>read(as("OPR-0021").get("/api/allowances").body(), "$.grants[*].status")).containsExactly("pending");
        assertThat(arjun.get("/api/hr/employees/OPR-0021/allowances").statusCode()).isEqualTo(403);
    }

    @Test
    void aNewAmountEndsTheOldOneTheMonthBeforeAndTellsThem() throws Exception {
        String set = ananya.put("/api/hr/employees/OPR-0018/allowances/housing", "{\"amount\":7000,\"currency\":\"MVR\",\"startsOn\":\"2026-12-01\"}").body();

        assertThat(JsonPath.<String>read(set, "$.startsOn")).isEqualTo("2026-12-01");
        assertThat(jdbc.queryForObject("select ends_on::text from monthly_allowance where id = 'MA-1'", String.class)).isEqualTo("2026-11-30");
        assertThat(notificationsOf(arjun)).contains("HR set your housing allowance to MVR 7,000 a month from December 2026.");

        // Changing a change that hasn't started replaces it.
        ananya.put("/api/hr/employees/OPR-0018/allowances/housing", "{\"amount\":7500,\"currency\":\"MVR\",\"startsOn\":\"2026-12-01\"}");
        assertThat(JsonPath.<List<Double>>read(arjun.get("/api/allowances").body(), "$.monthly[?(@.typeCode == 'housing')].amount")).containsExactly(7500.0, 6000.0);

        assertThat(ananya.put("/api/hr/employees/OPR-0018/allowances/housing", "{\"amount\":1,\"currency\":\"MVR\",\"startsOn\":\"2026-12-15\"}").body())
                .isEqualTo("{\"message\":\"Allowances start on the first of a month.\"}");
        assertThat(ananya.put("/api/hr/employees/OPR-0002/allowances/housing", "{\"amount\":1,\"currency\":\"MVR\",\"startsOn\":\"2026-12-01\"}").statusCode())
                .isEqualTo(403);
    }

    @Test
    void stoppingEndsItAfterTheLastMonthPaid() throws Exception {
        assertThat(ananya.post("/api/hr/employees/OPR-0018/allowances/food/stop", "{\"lastMonth\":\"2023-06\"}").statusCode()).isEqualTo(400);

        String stopped = ananya.post("/api/hr/employees/OPR-0018/allowances/food/stop", "{\"lastMonth\":\"2026-12\"}").body();

        assertThat(JsonPath.<String>read(stopped, "$.endsOn")).isEqualTo("2026-12-31");
        assertThat(notificationsOf(arjun)).contains("HR stopped your food allowance after December 2026.");
        assertThat(ananya.post("/api/hr/employees/OPR-0018/allowances/phone/stop", "{\"lastMonth\":\"2026-12\"}").statusCode()).isEqualTo(404);
    }

    @Test
    void anHodGrantsAReportAOneOffAndHrApprovesIt() throws Exception {
        String grant = "{\"employeeId\":\"OPR-0018\",\"type\":\"transport\",\"amount\":500,\"currency\":\"MVR\",\"reason\":\"Site visits by taxi\"}";
        assertThat(vikram.post("/api/team/allowance-grants", grant.replace("OPR-0018", "OPR-0002")).statusCode()).isEqualTo(404);
        String id = JsonPath.read(vikram.post("/api/team/allowance-grants", grant).body(), "$.id");
        assertThat(notificationsOf(ananya)).contains("Vikram Singh granted Arjun Reddy MVR 500 of transport allowance. Decide it from Inbox.");
        assertThat(JsonPath.<List<String>>read(ananya.get("/api/hr/allowance-grants").body(), "$[*].id")).contains(id, "AG-1");

        assertThat(ananya.post("/api/hr/allowance-grants/" + id + "/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(200);

        assertThat(notificationsOf(arjun)).contains("You've been granted MVR 500 of transport allowance: Site visits by taxi.");
        assertThat(ananya.post("/api/hr/allowance-grants/" + id + "/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(404);
    }

    @Test
    void hrDeclinesWithAReasonTheHodHears() throws Exception {
        assertThat(ananya.post("/api/hr/allowance-grants/AG-1/decision", "{\"decision\":\"rejected\"}").statusCode()).isEqualTo(400);

        ananya.post("/api/hr/allowance-grants/AG-1/decision", "{\"decision\":\"rejected\",\"note\":\"The ferry company is paying\"}");

        assertThat(notificationsOf(vikram)).contains("HR didn't approve the transport allowance for Rohit Verma: The ferry company is paying.");
        assertThat(JsonPath.<List<String>>read(vikram.get("/api/team/allowance-grants").body(), "$[?(@.id == 'AG-1')].status")).containsExactly("rejected");
    }

    @Test
    void hrKeepsTheKinds() throws Exception {
        assertThat(JsonPath.<String>read(ananya.post("/api/hr/allowance-types", "{\"name\":\"Uniform\"}").body(), "$.code")).isEqualTo("uniform");
        assertThat(ananya.post("/api/hr/allowance-types", "{\"name\":\"uniform\"}").statusCode()).isEqualTo(409);
        assertThat(ananya.delete("/api/hr/allowance-types/uniform").statusCode()).isEqualTo(204);

        ananya.delete("/api/hr/allowance-types/housing");
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/allowance-types").body(), "$[?(@.code == 'housing')].retiredOn")).containsExactly("2026-11-12");
        assertThat(arjun.post("/api/hr/allowance-types", "{\"name\":\"Bonus\"}").statusCode()).isEqualTo(403);
    }
}
