package mv.opro.hrms.insight;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import mv.opro.hrms.ApiClient;
import mv.opro.hrms.ApiTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

// The dashboard's facts: HR (Ananya, OPR-0002) and the super admin (Rajesh, OPR-0001) read them; nobody else does.
@ApiTest
class InsightApiTests {

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    @AfterEach
    void cleanUp() {
        jdbc.update("update employee set last_day = null, leaving_reason = null");
    }

    private ApiClient as(String employeeId) throws Exception {
        ApiClient client = new ApiClient(port);
        client.signIn(employeeId);
        return client;
    }

    @Test
    void hrAndSuperAdminsSeeEveryoneWithPapersLeaveBalancesAndQuota() throws Exception {
        jdbc.update("update employee set last_day = '2026-10-31', leaving_reason = 'Moved home' where id = 'OPR-0023'");

        String insights = as("OPR-0002").get("/api/insights").body();

        assertThat(JsonPath.<String>read(insights, "$.today")).isEqualTo("2026-11-12");
        assertThat(JsonPath.<List<String>>read(insights, "$.people[*].id")).hasSize(9);
        assertThat(JsonPath.<List<String>>read(insights, "$.people[?(@.id == 'OPR-0023')].lastDay")).containsExactly("2026-10-31");
        assertThat(JsonPath.<List<Object>>read(insights, "$.people[?(@.id == 'OPR-0023')].today")).isEmpty();
        assertThat(JsonPath.<List<String>>read(insights, "$.people[?(@.id == 'OPR-0018')].visaExpiry")).containsExactly("2026-12-20");
        assertThat(JsonPath.<List<String>>read(insights, "$.people[?(@.id == 'OPR-0018')].insuranceExpiry")).containsExactly("2027-04-30");
        assertThat(JsonPath.<List<String>>read(insights, "$.people[?(@.id == 'OPR-0018')].gender")).containsExactly("male");
        assertThat(JsonPath.<List<String>>read(insights, "$.leave[*].status")).contains("pending", "approved");
        assertThat(JsonPath.<List<String>>read(insights, "$.balances[?(@.employeeId == 'OPR-0018')].type")).contains("annual", "sick");
        assertThat(JsonPath.<List<Integer>>read(insights, "$.quotas[?(@.jobCategory == 'Engineering')].used")).containsExactly(1);
        assertThat(JsonPath.<List<String>>read(as("OPR-0001").get("/api/insights").body(), "$.people[*].id")).hasSize(9);
    }

    @Test
    void aMonthOfAttendanceCoversEveryoneStillHere() throws Exception {
        String month = as("OPR-0001").get("/api/insights/attendance?month=2026-11").body();

        assertThat(JsonPath.<List<String>>read(month, "$[*].employeeName")).hasSize(9 * 12).doesNotContainNull();
        assertThat(as("OPR-0001").get("/api/insights/attendance?month=November").statusCode()).isEqualTo(400);
    }

    @Test
    void nobodyElseGetsIn() throws Exception {
        assertThat(as("OPR-0004").get("/api/insights").body()).isEqualTo("{\"message\":\"HR and super admins only\"}");
        assertThat(as("OPR-0018").get("/api/insights/attendance?month=2026-11").statusCode()).isEqualTo(403);
    }
}
