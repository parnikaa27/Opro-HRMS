package mv.opro.hrms.attendance;

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

@ApiTest
class AttendanceApiTests {

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

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from punch");
        jdbc.update("delete from correction_request where length(id) > 6");
    }

    private void punch(String at, boolean voided) {
        jdbc.update("insert into punch (employee_id, punched_at, device_id, source, voided_at) values ('OPR-0018', ?::timestamptz, 'OPR-HMH-01', 'device', ?::timestamptz)",
                at, voided ? at : null);
    }

    private static String dayOf(String month, String date) {
        return JsonPath.<List<Object>>read(month, "$[?(@.date == '" + date + "')]").getFirst().toString();
    }

    @Test
    void theMonthSoFarIsWorkedOutFromPunchesHolidaysLeaveAndTheWeekend() throws Exception {
        punch("2026-11-10T08:55:00+05:00", false);
        punch("2026-11-10T17:20:00+05:00", false);
        punch("2026-11-12T09:40:00+05:00", false);

        String month = arjun.get("/api/attendance?month=2026-11").body();

        assertThat(JsonPath.<List<String>>read(month, "$[*].date")).hasSize(12).first().isEqualTo("2026-11-01");
        assertThat(JsonPath.<List<String>>read(month, "$[?(@.date == '2026-11-10')].status")).containsExactly("present");
        assertThat(JsonPath.<List<String>>read(month, "$[?(@.date == '2026-11-10')].punches[0].at")).containsExactly("2026-11-10T08:55:00+05:00");
        assertThat(JsonPath.<List<String>>read(month, "$[?(@.date == '2026-11-10')].punches[1].device")).containsExactly("Site gate");
        assertThat(JsonPath.<List<Integer>>read(month, "$[?(@.date == '2026-11-10')].workedMinutes")).containsExactly(505);
        assertThat(JsonPath.<List<String>>read(month, "$[?(@.date == '2026-11-12')].status")).containsExactly("late");
        assertThat(JsonPath.<List<String>>read(month, "$[?(@.date == '2026-11-12')].expectedOut")).containsExactly("2026-11-12T17:40:00+05:00");
        assertThat(JsonPath.<List<String>>read(month, "$[?(@.date == '2026-11-11')].status")).containsExactly("holiday");
        assertThat(JsonPath.<List<String>>read(month, "$[?(@.date == '2026-11-04')].status")).containsExactly("on-leave");
        assertThat(JsonPath.<List<String>>read(month, "$[?(@.date == '2026-11-06')].status")).containsExactly("weekend");
        assertThat(JsonPath.<List<String>>read(month, "$[?(@.date == '2026-11-09')].status")).containsExactly("absent");
        assertThat(dayOf(month, "2026-11-09")).doesNotContain("firstIn");
    }

    @Test
    void aVoidedPunchIsLeftOutAndTheDayShowsItWasCorrected() throws Exception {
        punch("2026-11-10T08:55:00+05:00", false);
        punch("2026-11-10T12:00:00+05:00", true);

        String month = arjun.get("/api/attendance?month=2026-11").body();

        assertThat(JsonPath.<List<String>>read(month, "$[?(@.date == '2026-11-10')].status")).containsExactly("incomplete");
        assertThat(JsonPath.<List<Boolean>>read(month, "$[?(@.date == '2026-11-10')].isCorrected")).containsExactly(true);
    }

    @Test
    void nothingBeforeTheyJoinedOrStillToCome() throws Exception {
        assertThat(JsonPath.<List<Object>>read(arjun.get("/api/attendance?month=2023-11").body(), "$")).isEmpty();
        assertThat(JsonPath.<List<Object>>read(arjun.get("/api/attendance?month=2026-12").body(), "$")).isEmpty();
    }

    @Test
    void aBadMonthIsRefusedPolitely() throws Exception {
        HttpResponse<String> response = arjun.get("/api/attendance?month=November");

        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(response.body()).isEqualTo("{\"message\":\"Month must look like 2026-11\"}");
    }

    @Test
    void theFingerprintDevicesAreGone() throws Exception {
        assertThat(arjun.get("/api/devices").statusCode()).isEqualTo(404);
    }

    @Test
    void aPunchFixIsRaisedAndListedWithTheTimeAsTheyTypedIt() throws Exception {
        HttpResponse<String> raised = arjun.post("/api/attendance/corrections",
                "{\"date\":\"2026-11-10\",\"kind\":\"missed-out\",\"category\":\"forgot\",\"requestedTime\":\"17:20\",\"reason\":\"  Device was offline  \"}");

        assertThat(raised.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<String>read(raised.body(), "$.category")).isEqualTo("forgot");
        assertThat(JsonPath.<String>read(raised.body(), "$.status")).isEqualTo("pending");
        assertThat(JsonPath.<String>read(raised.body(), "$.requestedTime")).isEqualTo("17:20");
        assertThat(JsonPath.<String>read(raised.body(), "$.reason")).isEqualTo("Device was offline");
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/attendance/corrections").body(), "$[*].id"))
                .contains(JsonPath.<String>read(raised.body(), "$.id"), "AC-298");
    }

    private HttpResponse<String> fix(String kind, String category, String reason) throws Exception {
        return arjun.post("/api/attendance/corrections", "{\"date\":\"2026-11-10\",\"kind\":\"" + kind + "\",\"category\":\"" + category
                + "\",\"requestedTime\":\"09:00\"" + (reason == null ? "" : ",\"reason\":\"" + reason + "\"") + "}");
    }

    @Test
    void aPunchFixNeedsADayThatHasHappenedAndAKnownKindAndType() throws Exception {
        assertThat(arjun.post("/api/attendance/corrections", "{\"date\":\"2026-11-20\",\"kind\":\"missed-in\",\"category\":\"forgot\",\"requestedTime\":\"09:00\"}").body())
                .isEqualTo("{\"message\":\"You can't fix a day that hasn't happened yet.\"}");
        assertThat(fix("forgot", "forgot", "x").statusCode()).isEqualTo(400);
        assertThat(fix("missed-in", "beach", "x").statusCode()).isEqualTo(400);
    }

    @Test
    void forgettingOrWorkingFromAResortNeedNoReason() throws Exception {
        assertThat(fix("missed-in", "forgot", null).statusCode()).isEqualTo(200);
        assertThat(JsonPath.<String>read(fix("missed-out", "resort", " ").body(), "$.category")).isEqualTo("resort");
    }

    @Test
    void aLatePunchOrAnythingElseNeedsAReasonAndALatePunchIsAboutThePunchIn() throws Exception {
        assertThat(fix("missed-in", "late", null).body()).isEqualTo("{\"message\":\"Say what happened, so your manager can check it.\"}");
        assertThat(fix("missed-in", "other", " ").statusCode()).isEqualTo(400);
        assertThat(fix("missed-out", "late", "Traffic").body()).isEqualTo("{\"message\":\"A late punch is about your punch in.\"}");
        assertThat(fix("missed-in", "late", "Reader queue at the gate").statusCode()).isEqualTo(200);
    }

    @Test
    void holidaysComeByYearWithTentativeIslamicDates() throws Exception {
        String holidays = arjun.get("/api/holidays?year=2026").body();

        assertThat(JsonPath.<List<String>>read(holidays, "$[*].date")).hasSize(17).first().isEqualTo("2026-01-01");
        assertThat(JsonPath.<List<Boolean>>read(holidays, "$[?(@.name == 'Eid al Fitr')].isTentative")).containsExactly(true);
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/holidays").body(), "$[*].date")).hasSize(17);
    }
}
