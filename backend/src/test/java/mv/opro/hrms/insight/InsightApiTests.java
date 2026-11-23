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
    void theDashboardSendsFiguresNotRecords() throws Exception {
        jdbc.update("update employee set last_day = '2026-10-31', leaving_reason = 'Moved home' where id = 'OPR-0023'");

        String dashboard = as("OPR-0002").get("/api/insights/dashboard").body();

        assertThat(JsonPath.<String>read(dashboard, "$.today")).isEqualTo("2026-11-12");
        assertThat(JsonPath.<Integer>read(dashboard, "$.workforce.total")).isEqualTo(8);
        assertThat(JsonPath.<Integer>read(dashboard, "$.workforce.leavers")).isEqualTo(1);
        int accountedFor = List.of("present", "notInYet", "absent", "onLeave").stream()
                .mapToInt(figure -> JsonPath.<Integer>read(dashboard, "$.presence." + figure)).sum();
        assertThat(accountedFor).as("everyone at work today is in, not in yet, absent or on leave").isEqualTo(8);
        assertThat(JsonPath.<List<String>>read(dashboard, "$.mix.origin[*].label")).contains("Expatriates", "Maldivians");
        assertThat(JsonPath.<List<Integer>>read(dashboard, "$.compliance.papers[?(@.kind == 'visa')].expiring")).containsExactly(1);
        assertThat(JsonPath.<Integer>read(dashboard, "$.compliance.quotaUsed")).isPositive();
        assertThat(JsonPath.<List<String>>read(dashboard, "$.leave.sickByMonth[*].month")).hasSize(6).endsWith("2026-11");
        assertThat(JsonPath.<String>read(dashboard, "$.month.month")).isEqualTo("2026-11");
        assertThat(dashboard).doesNotContain("dateOfBirth", "visaExpiry", "\"people\"");
        assertThat(as("OPR-0001").get("/api/insights/dashboard").statusCode()).isEqualTo(200);
    }

    @Test
    void eachReportIsTheRowsShownOnScreen() throws Exception {
        ApiClient hr = as("OPR-0002");

        String headcount = hr.get("/api/insights/reports/headcount").body();
        assertThat(JsonPath.<String>read(headcount, "$.fileName")).isEqualTo("headcount-2026-11-12");
        assertThat(JsonPath.<List<Object>>read(headcount, "$.rows")).hasSize(9);

        String papers = hr.get("/api/insights/reports/papers").body();
        assertThat(JsonPath.<List<String>>read(papers, "$.columns")).containsExactly("Name", "Visa", "Passport", "Employment approval", "Work permit medical",
                "Medical insurance", "Soonest, days");
        assertThat(JsonPath.<List<String>>read(papers, "$.rows[?(@[0] == 'Arjun Reddy')][1]")).containsExactly("2026-12-20");

        assertThat(JsonPath.<String>read(hr.get("/api/insights/reports/mix?by=gender").body(), "$.title")).isEqualTo("Workforce by gender");
        assertThat(JsonPath.<List<Object>>read(hr.get("/api/insights/reports/attendance?month=2026-11").body(), "$.rows")).hasSize(9);
        assertThat(JsonPath.<String>read(hr.get("/api/insights/reports/leave?year=2026").body(), "$.columns[1]")).isEqualTo("Leave type");

        assertThat(hr.get("/api/insights/reports/payroll").statusCode()).isEqualTo(404);
        assertThat(hr.get("/api/insights/reports/attendance?month=November").statusCode()).isEqualTo(400);
        assertThat(hr.get("/api/insights/reports/mix?by=height").statusCode()).isEqualTo(400);
    }

    @Test
    void nobodyElseGetsIn() throws Exception {
        assertThat(as("OPR-0004").get("/api/insights/dashboard").body()).isEqualTo("{\"message\":\"HR and super admins only\"}");
        assertThat(as("OPR-0018").get("/api/insights/reports/headcount").statusCode()).isEqualTo(403);
    }
}
