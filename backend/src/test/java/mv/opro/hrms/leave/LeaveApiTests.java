package mv.opro.hrms.leave;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import mv.opro.hrms.ApiClient;
import mv.opro.hrms.ApiTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

@ApiTest
class LeaveApiTests {

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient arjun;

    @BeforeEach
    void signIn() throws Exception {
        arjun = new ApiClient(port);
        arjun.signIn("OPR-0018");
    }

    // Seeded requests have short ids (LR-1031). Ones made by these tests are random and longer.
    @AfterEach
    void cleanUp() {
        jdbc.update("delete from leave_request where length(id) > 7");
        jdbc.update("delete from leave_entitlement where leave_year = 2027");
        jdbc.update("update leave_entitlement set entitled = 10, taken_before = 3 where employee_id = 'OPR-0018' and type = 'family'");
        jdbc.update("update leave_request set status = 'approved' where id = 'LR-1031'");
    }

    private HttpResponse<String> apply(String type, String from, String to, String extra) throws Exception {
        return arjun.post("/api/leave/requests",
                "{\"type\":\"" + type + "\",\"from\":\"" + from + "\",\"to\":\"" + to + "\",\"reason\":\"Family trip\"" + extra + "}");
    }

    private static String balance(String balances, String type, String field) {
        return JsonPath.<List<Object>>read(balances, "$[?(@.type == '" + type + "')]." + field).getFirst().toString();
    }

    @Test
    void typesComeInThePolicysOrderAndUnpaidHasNoCap() throws Exception {
        String types = arjun.get("/api/leave/types").body();

        assertThat(JsonPath.<List<String>>read(types, "$[*].code")).containsExactly("annual", "sick", "family", "maternity", "paternity", "unpaid", "comp-off");
        assertThat(JsonPath.<List<Boolean>>read(types, "$[?(@.code == 'unpaid')].isUnlimited")).containsExactly(true);
        assertThat(JsonPath.<List<Integer>>read(types, "$[?(@.code == 'sick')].documentRequiredAfterDays")).containsExactly(2);
    }

    @Test
    void balancesAddLeaveFromBeforeTheSystemToApprovedRequests() throws Exception {
        String balances = arjun.get("/api/leave/balances").body();

        assertThat(JsonPath.<List<String>>read(balances, "$[*].type")).containsExactly("annual", "sick", "family", "paternity");
        assertThat(balance(balances, "annual", "taken")).isEqualTo("18.0");
        // Five days from before Opro HRMS, plus the approved day of sick leave on 4 November.
        assertThat(balance(balances, "sick", "taken")).isEqualTo("6.0");
    }

    @Test
    void theServerCountsTheDaysWhateverTheClientSays() throws Exception {
        // Sunday 6 to Saturday 12 December: six working days, with Friday 11 off.
        HttpResponse<String> response = apply("annual", "2026-12-06", "2026-12-12", ",\"days\":1");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<Number>read(response.body(), "$.days").doubleValue()).isEqualTo(6.0);
        assertThat(JsonPath.<String>read(response.body(), "$.status")).isEqualTo("pending");
        assertThat(JsonPath.<String>read(response.body(), "$.employeeName")).isEqualTo("Arjun Reddy");
        assertThat(balance(arjun.get("/api/leave/balances").body(), "annual", "pending")).isEqualTo("6.0");
    }

    @Test
    void aHalfDayIsHalfOfOneDayAndOnlyForTypesThatAllowIt() throws Exception {
        assertThat(JsonPath.<Number>read(apply("family", "2026-12-07", "2026-12-07", ",\"halfDay\":\"first\"").body(), "$.days").doubleValue()).isEqualTo(0.5);
        assertThat(apply("family", "2026-12-08", "2026-12-09", ",\"halfDay\":\"first\"").body())
                .isEqualTo("{\"message\":\"A half day has to be a single day.\"}");
        assertThat(apply("paternity", "2026-12-08", "2026-12-08", ",\"halfDay\":\"second\"").body())
                .isEqualTo("{\"message\":\"Paternity leave can't be taken as a half day.\"}");
    }

    @Test
    void impossibleDatesAreRefusedWithAReason() throws Exception {
        assertThat(apply("annual", "2026-12-10", "2026-12-08", "").body()).isEqualTo("{\"message\":\"The last day can't be before the first.\"}");
        assertThat(apply("annual", "2026-12-04", "2026-12-04", "").body())
                .isEqualTo("{\"message\":\"Those dates are all Fridays or public holidays. Nothing to take.\"}");
        assertThat(apply("annual", "2026-12-30", "2027-01-03", "").body())
                .isEqualTo("{\"message\":\"Leave can't run past New Year. Split it into two requests, one for each year.\"}");
    }

    @Test
    void overlappingLeaveIsRefused() throws Exception {
        apply("annual", "2026-12-06", "2026-12-08", "");

        HttpResponse<String> response = apply("family", "2026-12-08", "2026-12-08", "");

        assertThat(response.statusCode()).isEqualTo(409);
        assertThat(response.body()).isEqualTo("{\"message\":\"You already have leave on some of those days.\"}");
    }

    @Test
    void youCantTakeMoreThanIsLeftOrATypeYouDontHold() throws Exception {
        assertThat(apply("family", "2026-12-06", "2026-12-17", "").body()).isEqualTo("{\"message\":\"You only have 7 days of family responsibility leave left.\"}");
        assertThat(apply("maternity", "2026-12-06", "2026-12-06", "").body()).isEqualTo("{\"message\":\"You don't have maternity leave to take.\"}");
        assertThat(apply("unpaid", "2026-12-06", "2026-12-24", "").statusCode()).isEqualTo(200);
    }

    @Test
    void bookingIntoNextYearOpensItsBalanceFromThePolicy() throws Exception {
        HttpResponse<String> response = apply("annual", "2027-01-10", "2027-01-11", "");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(jdbc.queryForObject("select entitled from leave_entitlement where employee_id = 'OPR-0018' and type = 'annual' and leave_year = 2027", Double.class))
                .isEqualTo(30.0);
    }

    @Test
    void twoRequestsSentAtOnceCantBothSpendTheLastDays() throws Exception {
        jdbc.update("update leave_entitlement set entitled = 2, taken_before = 0 where employee_id = 'OPR-0018' and type = 'family'");

        List<CompletableFuture<HttpResponse<String>>> both = List.of(
                CompletableFuture.supplyAsync(() -> applyQuietly("2026-12-06", "2026-12-07")),
                CompletableFuture.supplyAsync(() -> applyQuietly("2026-12-13", "2026-12-14")));

        assertThat(both.stream().map(CompletableFuture::join).map(HttpResponse::statusCode).toList()).containsExactlyInAnyOrder(200, 409);
    }

    private HttpResponse<String> applyQuietly(String from, String to) {
        try {
            return apply("family", from, to, "");
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    @Test
    void pendingLeaveCanBeCancelledButStartedOrOtherPeoplesCant() throws Exception {
        String id = JsonPath.read(apply("annual", "2026-12-06", "2026-12-06", "").body(), "$.id");

        assertThat(JsonPath.<String>read(arjun.post("/api/leave/requests/" + id + "/cancel", "{}").body(), "$.status")).isEqualTo("cancelled");
        assertThat(arjun.post("/api/leave/requests/LR-1031/cancel", "{}").statusCode()).isEqualTo(409);
        assertThat(arjun.post("/api/leave/requests/LR-1042/cancel", "{}").statusCode()).isEqualTo(404);
    }

    @Test
    void ownRequestsComeNewestFirst() throws Exception {
        apply("annual", "2026-12-06", "2026-12-06", "");

        String requests = arjun.get("/api/leave/requests").body();

        assertThat(JsonPath.<List<String>>read(requests, "$[*].from")).containsExactly("2026-12-06", "2026-11-04");
        assertThat(JsonPath.<List<String>>read(requests, "$[?(@.id == 'LR-1031')].decidedByName")).containsExactly("Vikram Singh");
    }
}
