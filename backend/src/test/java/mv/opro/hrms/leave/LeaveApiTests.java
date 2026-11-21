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
        jdbc.update("delete from leave_entitlement where employee_id = 'OPR-0018' and leave_year = 2026");
        jdbc.update("update leave_type set notice_days = null");
        jdbc.update("delete from holiday where length(id) > 5");
        jdbc.update("delete from notification where id > 7");
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
        // Arjun joined on 20 December, so his leave year ends on the 19th.
        assertThat(apply("annual", "2026-12-17", "2026-12-22", "").body())
                .isEqualTo("{\"message\":\"Your leave year ends on Saturday 19 December. Split this into two requests, one each side of it.\"}");
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
        assertThat(apply("unpaid", "2026-12-06", "2026-12-17", "").statusCode()).isEqualTo(200);
    }

    @Test
    void bookingIntoNextLeaveYearOpensItsBalanceFromThePolicy() throws Exception {
        // Arjun's next leave year starts on 20 December, his joining anniversary, not in January.
        HttpResponse<String> response = apply("annual", "2026-12-27", "2026-12-28", "");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(jdbc.queryForObject("select entitled from leave_entitlement where employee_id = 'OPR-0018' and type = 'annual' and leave_year = 2026", Double.class))
                .isEqualTo(30.0);
    }

    @Test
    void takenToDateCountsOnlyApprovedDaysUpToToday() throws Exception {
        jdbc.update("insert into leave_request (id, employee_id, type, from_date, to_date, days, reason, status, applied_on) values "
                + "('LR-TEST-1', 'OPR-0018', 'family', '2026-11-10', '2026-11-15', 4, 'Home', 'approved', '2026-11-01')");

        String balances = arjun.get("/api/leave/balances").body();

        // Tuesday 10 to Sunday 15 November is 4 working days (11th is Republic Day, 13th a Friday). Tuesday and today are past.
        assertThat(balance(balances, "family", "taken")).isEqualTo("7.0");
        assertThat(balance(balances, "family", "takenToDate")).isEqualTo("5.0");
    }

    @Test
    void aTypeWithNoticeIsAskedForThatFarAhead() throws Exception {
        jdbc.update("update leave_type set notice_days = 30 where code = 'annual'");

        assertThat(apply("annual", "2026-12-06", "2026-12-06", "").body())
                .isEqualTo("{\"message\":\"Annual leave is asked for 30 days ahead. The earliest it can start is Saturday 12 December.\"}");
        assertThat(apply("annual", "2026-12-13", "2026-12-13", "").statusCode()).isEqualTo(200);
        assertThat(apply("sick", "2026-11-15", "2026-11-15", "").statusCode()).isEqualTo(200);
    }

    @Test
    void anApprovedAmendmentReplacesTheRequestItAmends() throws Exception {
        String original = JsonPath.read(apply("annual", "2026-12-06", "2026-12-08", ",\"usesFlightEntitlement\":true").body(), "$.id");

        HttpResponse<String> amended = apply("annual", "2026-12-07", "2026-12-09", ",\"kind\":\"amended\",\"relatedRequestId\":\"" + original + "\"");
        String id = JsonPath.read(amended.body(), "$.id");
        assertThat(JsonPath.<String>read(amended.body(), "$.kind")).isEqualTo("amended");
        assertThat(jdbc.queryForObject("select status from leave_request where id = ?", String.class, original)).isEqualTo("pending");

        ApiClient vikram = new ApiClient(port);
        vikram.signIn("OPR-0004");
        vikram.post("/api/team/leave-requests/" + id + "/decision", "{\"decision\":\"approved\"}");

        assertThat(jdbc.queryForObject("select status from leave_request where id = ?", String.class, original)).isEqualTo("cancelled");
        assertThat(jdbc.queryForObject("select uses_flight_entitlement from leave_request where id = ?", Boolean.class, original)).isTrue();
    }

    @Test
    void anExtensionFollowsStraightOnFromTheLeaveItExtends() throws Exception {
        // Ends Thursday 10 December. Friday is off, so Saturday the 12th follows straight on.
        String original = JsonPath.read(apply("annual", "2026-12-08", "2026-12-10", "").body(), "$.id");
        String extending = ",\"kind\":\"extended\",\"relatedRequestId\":\"" + original + "\"";

        assertThat(apply("unpaid", "2026-12-14", "2026-12-14", extending).body())
                .isEqualTo("{\"message\":\"An extension starts straight after the leave it extends, which ends on Thursday 10 December. With a gap, it's a new request.\"}");
        assertThat(apply("unpaid", "2026-12-12", "2026-12-13", extending).statusCode()).isEqualTo(200);
        assertThat(apply("unpaid", "2026-12-15", "2026-12-15", ",\"kind\":\"extended\"").body())
                .isEqualTo("{\"message\":\"Pick the request you're extending.\"}");
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

    @Test
    void aNewHolidayGivesBackTheDayAndCancelsLeaveItCoversWhole() throws Exception {
        // Sunday 6 to Tuesday 8 December is three working days; Wednesday 9 is one.
        String trip = JsonPath.read(apply("family", "2026-12-06", "2026-12-08", "").body(), "$.id");
        String dayOff = JsonPath.read(apply("family", "2026-12-09", "2026-12-09", "").body(), "$.id");
        ApiClient ananya = new ApiClient(port);
        ananya.signIn("OPR-0002");

        ananya.post("/api/hr/holidays", "{\"date\":\"2026-12-07\",\"name\":\"Extra holiday\",\"isTentative\":false}");
        String moved = JsonPath.read(ananya.post("/api/hr/holidays", "{\"date\":\"2026-12-20\",\"name\":\"Moving one\",\"isTentative\":true}").body(), "$.id");
        ananya.put("/api/hr/holidays/" + moved, "{\"date\":\"2026-12-09\",\"name\":\"Moving one\",\"isTentative\":false}");

        assertThat(jdbc.queryForObject("select days from leave_request where id = ?", Double.class, trip)).isEqualTo(2.0);
        assertThat(jdbc.queryForObject("select status from leave_request where id = ?", String.class, dayOff)).isEqualTo("cancelled");
        List<String> told = JsonPath.read(arjun.get("/api/notifications").body(), "$[*].text");
        assertThat(told).contains("Your family responsibility leave from 6 December now takes 2 days, not 3, because the public holidays changed.",
                "Your family responsibility leave on 9 December is cancelled: it's a public holiday now, so you don't need it.");
    }

    @Test
    void leaveCanBeBookedForAnyDayInThisLeaveYearButNotBefore() throws Exception {
        // Arjun's leave year started on 20 December 2025.
        assertThat(apply("family", "2026-10-06", "2026-10-06", "").statusCode()).isEqualTo(200);
        assertThat(apply("family", "2025-12-18", "2025-12-18", "").body())
                .isEqualTo("{\"message\":\"Your leave year started on 20 December 2025. Leave before that can't be booked now; ask HR.\"}");
    }
}
