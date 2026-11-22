package mv.opro.hrms.hr;

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

// Ananya (OPR-0002) is HR. Arjun (OPR-0018) has 30 annual days for 2026 with 18 taken, so 12 left.
@ApiTest
class LeaveTypesApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;
    private static final String MARRIAGE = """
            {"name":"Marriage leave","allowsHalfDay":false,"isUnlimited":false,"defaultEntitlement":5,"isForEveryone":%s,
             "carriesForward":false,"needsHrApproval":false}""";

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient ananya;
    ApiClient arjun;

    @BeforeEach
    void signIn() throws Exception {
        ananya = as("OPR-0002");
        arjun = as("OPR-0018");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from leave_request where length(id) > 7");
        jdbc.update("delete from balance_adjustment where id <> 'BA-1'");
        jdbc.update("delete from leave_entitlement where type not in ('annual', 'sick', 'family', 'maternity', 'paternity') or leave_year <> case when employee_id = 'OPR-0018' then 2025 else 2026 end");
        jdbc.update("update leave_entitlement set entitled = 30, removed_on = null where employee_id = 'OPR-0018' and type = 'annual'");
        jdbc.update("update leave_entitlement set removed_on = null");
        jdbc.update("insert into leave_entitlement (employee_id, type, leave_year, entitled, taken_before) values ('OPR-0018', 'family', 2025, 10, 3) on conflict do nothing");
        jdbc.update("delete from leave_type where code not in ('annual', 'sick', 'family', 'maternity', 'paternity', 'unpaid', 'comp-off')");
        jdbc.update("update leave_type set retired_on = null, carries_forward = false, carry_forward_cap = null");
        jdbc.update("delete from notification where id > ?", SEEDED_NOTIFICATIONS);
    }

    private ApiClient as(String employeeId) throws Exception {
        ApiClient client = new ApiClient(port);
        client.signIn(employeeId);
        return client;
    }

    private List<String> balanceTypes(ApiClient client) throws Exception {
        return JsonPath.read(client.get("/api/leave/balances").body(), "$[*].type");
    }

    private String balance(ApiClient client, String type, String field) throws Exception {
        return JsonPath.<List<Object>>read(client.get("/api/leave/balances").body(), "$[?(@.type == '" + type + "')]." + field).getFirst().toString();
    }

    private void annualCarriesForward(int cap) {
        jdbc.update("update leave_type set carries_forward = true, carry_forward_cap = ? where code = 'annual'", cap);
    }

    @Test
    void aTypeForEveryoneReachesEveryoneStraightAway() throws Exception {
        String added = ananya.post("/api/hr/leave-types", MARRIAGE.formatted(true)).body();

        assertThat(JsonPath.<String>read(added, "$.code")).isEqualTo("marriage-leave");
        assertThat(balanceTypes(arjun)).contains("marriage-leave");
        assertThat(balance(arjun, "marriage-leave", "entitled")).isEqualTo("5.0");
    }

    @Test
    void aTypeGivenOneByOneReachesNobodyUntilHrGivesIt() throws Exception {
        ananya.post("/api/hr/leave-types", MARRIAGE.formatted(false));

        assertThat(balanceTypes(arjun)).doesNotContain("marriage-leave");

        ananya.put("/api/hr/employees/OPR-0018/leave/marriage-leave", "{\"days\":5,\"reason\":\"Getting married in December\"}");

        assertThat(balance(arjun, "marriage-leave", "entitled")).isEqualTo("5.0");
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/notifications").body(), "$[*].text"))
                .contains("HR set your marriage leave to 5 days this year. Getting married in December.");
    }

    @Test
    void namesAreUniqueAndRulesComplete() throws Exception {
        ananya.post("/api/hr/leave-types", MARRIAGE.formatted(true));

        assertThat(ananya.post("/api/hr/leave-types", MARRIAGE.formatted(true)).body()).isEqualTo("{\"message\":\"There's already a leave type called that.\"}");
        assertThat(ananya.post("/api/hr/leave-types", MARRIAGE.formatted(true).replace("Marriage", "Study").replace(",\"defaultEntitlement\":5", "")).body())
                .isEqualTo("{\"message\":\"Say how many days a year it gives.\"}");
        assertThat(ananya.post("/api/hr/leave-types", MARRIAGE.formatted(true).replace("Marriage", "Study").replace("\"carriesForward\":false", "\"carriesForward\":true")).body())
                .isEqualTo("{\"message\":\"Say how many days can carry forward.\"}");
    }

    @Test
    void anUnusedTypeIsDeletedAndAUsedOneIsRetired() throws Exception {
        ananya.post("/api/hr/leave-types", MARRIAGE.formatted(false));
        assertThat(ananya.delete("/api/hr/leave-types/marriage-leave").statusCode()).isEqualTo(204);
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/leave/types").body(), "$[*].code")).doesNotContain("marriage-leave");

        assertThat(ananya.delete("/api/hr/leave-types/family").statusCode()).isEqualTo(204);

        assertThat(JsonPath.<List<String>>read(arjun.get("/api/leave/types").body(), "$[?(@.code == 'family')].retiredOn")).containsExactly("2026-11-12");
        assertThat(balanceTypes(arjun)).doesNotContain("family");
        assertThat(arjun.post("/api/leave/requests", "{\"type\":\"family\",\"from\":\"2026-12-07\",\"to\":\"2026-12-07\",\"reason\":\"School\"}").body())
                .isEqualTo("{\"message\":\"Family responsibility leave isn't offered any more.\"}");
    }

    @Test
    void compensatoryOffStays() throws Exception {
        HttpResponse<String> response = ananya.delete("/api/hr/leave-types/comp-off");

        assertThat(response.statusCode()).isEqualTo(409);
        assertThat(response.body()).isEqualTo("{\"message\":\"Compensatory off pays back Fridays and holidays worked, so it stays.\"}");
    }

    @Test
    void whatIsLeftCarriesForwardUpToTheCap() throws Exception {
        // Arjun's last leave year (20 December 2024 to 19 December 2025): 30 days, 22 taken, so 8 left.
        jdbc.update("insert into leave_entitlement (employee_id, type, leave_year, entitled, taken_before) values ('OPR-0018', 'annual', 2024, 30, 22)");

        assertThat(balance(arjun, "annual", "carriedOver")).isEqualTo("0");
        annualCarriesForward(15);
        assertThat(balance(arjun, "annual", "carriedOver")).isEqualTo("8.0");
        assertThat(balance(arjun, "annual", "entitled")).isEqualTo("38.0");
        annualCarriesForward(5);
        assertThat(balance(arjun, "annual", "carriedOver")).isEqualTo("5.0");
    }

    @Test
    void carriedDaysCanBeBookedNextYear() throws Exception {
        // 12 left this leave year. Without carry forward, the next one (from 20 December) opens with 30 and this is too long. With it, 30 plus 12 is enough.
        String longTrip = "{\"type\":\"annual\",\"from\":\"2027-02-01\",\"to\":\"2027-03-12\",\"reason\":\"Long trip home\"}";
        assertThat(arjun.post("/api/leave/requests", longTrip).statusCode()).isEqualTo(409);
        annualCarriesForward(15);

        HttpResponse<String> response = arjun.post("/api/leave/requests", longTrip);

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<Number>read(response.body(), "$.days").doubleValue()).isGreaterThan(30.0);
    }

    @Test
    void aMissingYearOpensByItself() throws Exception {
        jdbc.update("delete from leave_entitlement where employee_id = 'OPR-0018' and type = 'family'");

        assertThat(balance(arjun, "family", "entitled")).isEqualTo("10.0");
    }

    @Test
    void hrSetsFewerDaysForSomeoneWhoJoinedLateButNeverBelowWhatIsUsed() throws Exception {
        ananya.put("/api/hr/employees/OPR-0018/leave/annual", "{\"days\":20,\"reason\":\"Pro rata\"}");

        assertThat(balance(arjun, "annual", "entitled")).isEqualTo("20.0");
        assertThat(JsonPath.<Number>read(ananya.get("/api/hr/employees/OPR-0018").body(), "$.adjustments[0].days").doubleValue()).isEqualTo(-10.0);
        assertThat(ananya.put("/api/hr/employees/OPR-0018/leave/annual", "{\"days\":10,\"reason\":\"Oops\"}").body())
                .isEqualTo("{\"message\":\"They've already taken or booked 18 days, so it can't go below that.\"}");
        assertThat(ananya.put("/api/hr/employees/OPR-0018/leave/annual", "{\"days\":20,\"reason\":\"Again\"}").statusCode()).isEqualTo(400);
    }

    @Test
    void hrTakesATypeAwayFromOnePersonAndCanGiveItBack() throws Exception {
        ananya.post("/api/hr/employees/OPR-0018/leave/paternity/remove", "{\"reason\":\"Given by mistake\"}");

        assertThat(balanceTypes(arjun)).doesNotContain("paternity");
        assertThat(arjun.post("/api/leave/requests", "{\"type\":\"paternity\",\"from\":\"2026-12-07\",\"to\":\"2026-12-07\",\"reason\":\"Baby\"}").body())
                .isEqualTo("{\"message\":\"You don't have paternity leave to take.\"}");

        ananya.put("/api/hr/employees/OPR-0018/leave/paternity", "{\"days\":3,\"reason\":\"Baby due in December\"}");
        assertThat(balanceTypes(arjun)).contains("paternity");
    }

    @Test
    void aTypeWithAWaitingRequestStaysUntilItIsDecided() throws Exception {
        arjun.post("/api/leave/requests", "{\"type\":\"family\",\"from\":\"2026-12-07\",\"to\":\"2026-12-07\",\"reason\":\"School\"}");

        assertThat(ananya.post("/api/hr/employees/OPR-0018/leave/family/remove", "{\"reason\":\"Changing contract\"}").body())
                .isEqualTo("{\"message\":\"Decide their waiting family responsibility leave request first.\"}");
    }

    @Test
    void hrNeverChangesTheirOwnLeave() throws Exception {
        assertThat(ananya.put("/api/hr/employees/OPR-0002/leave/annual", "{\"days\":60,\"reason\":\"Me\"}").statusCode()).isEqualTo(403);
        assertThat(as("OPR-0004").post("/api/hr/leave-types", MARRIAGE.formatted(true)).statusCode()).isEqualTo(403);
    }
}
