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

// Aishath (OPR-0002) is HR. Ibrahim (OPR-0004) manages Kasun (OPR-0018), Rahim (OPR-0021) and four others.
@ApiTest
class HrApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;
    private static final String NEWCOMER = """
            {"fullName":"Nadia Hameed","designation":"Accountant","department":"Finance","email":"nadia.hameed@opro.mv","phone":"+960 777 1030",
             "joinedOn":"2026-11-01","bloodGroup":"B+","nationality":"Indian","workLocation":"Malé office","employmentType":"Full-time",
             "managerId":"OPR-0004","emergencyContact":{"name":"Faisal Hameed","relation":"Brother","phone":"+91 98470 11111"}}""";

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient aishath;

    @BeforeEach
    void signIn() throws Exception {
        aishath = as("OPR-0002");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from punch_edit");
        jdbc.update("delete from punch");
        jdbc.update("delete from balance_adjustment where id <> 'BA-1'");
        jdbc.update("update leave_entitlement set entitled = 32 where employee_id = 'OPR-0021' and type = 'annual' and leave_year = 2026");
        jdbc.update("delete from leave_entitlement where employee_id = 'OPR-0018' and type = 'maternity'");
        jdbc.update("delete from leave_request where length(id) > 7");
        jdbc.update("update leave_request set status = 'pending', decided_by = null, decided_on = null, decision_note = null where id in ('LR-1043', 'LR-1044')");
        jdbc.update("update leave_type set name = 'Annual leave', default_entitlement = 30 where code = 'annual'");
        jdbc.update("update employee set last_day = null, leaving_reason = null");
        jdbc.update("delete from visa where employee_id > 'OPR-0027'");
        jdbc.update("delete from leave_entitlement where employee_id > 'OPR-0027'");
        jdbc.update("delete from notification where id > ? or employee_id > 'OPR-0027'", SEEDED_NOTIFICATIONS);
        jdbc.update("delete from employee where id > 'OPR-0027'");
        jdbc.update("delete from holiday where length(id) > 5");
        jdbc.update("update holiday set is_tentative = true where id = 'HD-19'");
        jdbc.update("delete from company_event where length(id) > 4");
        jdbc.update("delete from work_schedule where id <> 'WS-1'");
        jdbc.update("update change_request set status = 'open', decided_by = null, decided_on = null, decision_note = null where id = 'CR-11'");
        jdbc.update("delete from announcement where length(id) > 5");
    }

    private ApiClient as(String employeeId) throws Exception {
        ApiClient client = new ApiClient(port);
        client.signIn(employeeId);
        return client;
    }

    private List<String> notificationsOf(String employeeId) throws Exception {
        return JsonPath.read(as(employeeId).get("/api/notifications").body(), "$[*].text");
    }

    @Test
    void onlyHrGetsIn() throws Exception {
        ApiClient ibrahim = as("OPR-0004");

        assertThat(ibrahim.get("/api/hr/employees").statusCode()).isEqualTo(403);
        assertThat(ibrahim.post("/api/hr/announcements", "{\"title\":\"Hi\",\"body\":\"Hello\"}").body()).isEqualTo("{\"message\":\"HR only\"}");
        assertThat(ibrahim.delete("/api/hr/schedules/WS-1").statusCode()).isEqualTo(403);
    }

    // People

    @Test
    void addsSomeoneWithTheNextIdAndAFullYearOfLeave() throws Exception {
        HttpResponse<String> response = aishath.post("/api/hr/employees", NEWCOMER);

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<String>read(response.body(), "$.id")).isEqualTo("OPR-0028");
        String detail = aishath.get("/api/hr/employees/OPR-0028").body();
        assertThat(JsonPath.<List<String>>read(detail, "$.leaveBalances[*].type")).containsExactly("annual", "sick", "family");
        assertThat(JsonPath.<List<String>>read(detail, "$.roles")).containsExactly("EMPLOYEE");
        assertThat(JsonPath.<List<String>>read(as("OPR-0004").get("/api/team").body(), "$[*].id")).contains("OPR-0028");
    }

    @Test
    void refusesADuplicateEmailAndAManagerFromBelow() throws Exception {
        String taken = NEWCOMER.replace("nadia.hameed@opro.mv", "KASUN.PERERA@opro.mv");
        assertThat(aishath.post("/api/hr/employees", taken).body()).isEqualTo("{\"message\":\"That email is already in use.\"}");

        // Ibrahim can't report to Kasun, who reports to him.
        String ibrahim = aishath.get("/api/hr/employees/OPR-0004").body();
        String loop = NEWCOMER.replace("nadia.hameed@opro.mv", JsonPath.read(ibrahim, "$.email")).replace("OPR-0004", "OPR-0018");
        HttpResponse<String> response = aishath.put("/api/hr/employees/OPR-0004", loop);

        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(response.body()).isEqualTo("{\"message\":\"Pick a manager who is active and not one of their reports.\"}");
    }

    @Test
    void movingSomeoneTellsThemAndTheirNewManager() throws Exception {
        aishath.post("/api/hr/employees", NEWCOMER);

        aishath.put("/api/hr/employees/OPR-0028", NEWCOMER.replace("OPR-0004", "OPR-0001"));

        assertThat(notificationsOf("OPR-0028")).containsExactly("HR updated your details. You now report to Hassan Waheed.");
        assertThat(notificationsOf("OPR-0001")).contains("Nadia Hameed now reports to you.");
    }

    @Test
    void aManagerHandsOverTheirReportsBeforeLeaving() throws Exception {
        HttpResponse<String> response = aishath.post("/api/hr/employees/OPR-0004/leaving", "{\"lastDay\":\"2026-12-31\",\"reason\":\"Moving abroad\"}");

        assertThat(response.statusCode()).isEqualTo(409);
        assertThat(response.body()).isEqualTo("{\"message\":\"Move their 6 reports to another manager first.\"}");
    }

    @Test
    void leavingCancelsLeaveAfterTheLastDayAndCanBeTakenBack() throws Exception {
        // Rahim has half a day of family leave waiting for 18 November.
        String left = aishath.post("/api/hr/employees/OPR-0021/leaving", "{\"lastDay\":\"2026-11-16\",\"reason\":\"Contract ended\"}").body();

        assertThat(JsonPath.<String>read(left, "$.lastDay")).isEqualTo("2026-11-16");
        assertThat(jdbc.queryForObject("select status from leave_request where id = 'LR-1044'", String.class)).isEqualTo("cancelled");

        assertThat(aishath.delete("/api/hr/employees/OPR-0021/leaving").statusCode()).isEqualTo(200);
        assertThat(jdbc.queryForObject("select last_day from employee where id = 'OPR-0021'", String.class)).isNull();
    }

    @Test
    void peopleWhoHaveLeftOnlyShowWhenAskedFor() throws Exception {
        jdbc.update("update employee set last_day = '2026-11-01', leaving_reason = 'Contract ended' where id = 'OPR-0027'");

        assertThat(JsonPath.<List<String>>read(aishath.get("/api/hr/employees").body(), "$[*].id")).doesNotContain("OPR-0027");
        assertThat(JsonPath.<List<String>>read(aishath.get("/api/hr/employees?include=former").body(), "$[*].id")).contains("OPR-0027");
        assertThat(aishath.delete("/api/hr/employees/OPR-0027/leaving").body()).isEqualTo("{\"message\":\"They have already left.\"}");
    }

    @Test
    void savesPapersWithOnlyTheLastFourOfThePassport() throws Exception {
        aishath.post("/api/hr/employees", NEWCOMER);
        String visa = """
                {"workPermitNumber":"WP-2026-1","visaNumber":"MV-EV-1","passportLast4":"%s","passportExpiry":"2031-01-01",
                 "visaIssuedOn":"2026-11-15","visaExpiry":"2027-11-14"}""";

        assertThat(aishath.put("/api/hr/employees/OPR-0028/visa", visa.formatted("Z1234567")).statusCode()).isEqualTo(400);
        String saved = aishath.put("/api/hr/employees/OPR-0028/visa", visa.formatted("ab12")).body();

        assertThat(JsonPath.<String>read(saved, "$.passportLast4")).isEqualTo("AB12");
        assertThat(JsonPath.<String>read(aishath.get("/api/hr/employees/OPR-0028").body(), "$.visa.visaExpiry")).isEqualTo("2027-11-14");
        assertThat(notificationsOf("OPR-0028")).containsExactly("HR updated your visa and work permit details. Expiry reminders follow the new dates.");
    }

    // Leave

    @Test
    void recordsLeaveForSomeoneAsApproved() throws Exception {
        String body = "{\"employeeId\":\"OPR-0018\",\"type\":\"sick\",\"from\":\"2026-11-15\",\"to\":\"2026-11-16\",\"reason\":\"Called in with a fever\"}";

        String recorded = aishath.post("/api/hr/leave-requests", body).body();

        assertThat(JsonPath.<String>read(recorded, "$.status")).isEqualTo("approved");
        assertThat(JsonPath.<Boolean>read(recorded, "$.recordedByHr")).isTrue();
        assertThat(notificationsOf("OPR-0018")).contains("HR recorded 2 days of sick leave for you, Sunday 15 November to Monday 16 November. Called in with a fever.");
    }

    @Test
    void hrNeverActsOnTheirOwnLeaveOrPunches() throws Exception {
        String leave = "{\"employeeId\":\"OPR-0002\",\"type\":\"annual\",\"from\":\"2026-11-15\",\"to\":\"2026-11-15\",\"reason\":\"Trip\"}";
        String balance = "{\"employeeId\":\"OPR-0002\",\"type\":\"annual\",\"days\":5,\"reason\":\"Because\"}";
        String punch = "{\"employeeId\":\"OPR-0002\",\"date\":\"2026-11-10\",\"action\":\"add\",\"time\":\"09:00\",\"reason\":\"Forgot\"}";

        assertThat(aishath.post("/api/hr/leave-requests", leave).statusCode()).isEqualTo(403);
        assertThat(aishath.post("/api/hr/balance-adjustments", balance).statusCode()).isEqualTo(403);
        assertThat(aishath.post("/api/hr/punch-edits", punch).body()).isEqualTo("{\"message\":\"Your own punches go through your manager.\"}");
    }

    @Test
    void decidesAnyRequestWhenTheManagerIsAway() throws Exception {
        String decided = aishath.post("/api/hr/leave-requests/LR-1043/decision", "{\"decision\":\"approved\"}").body();

        assertThat(JsonPath.<String>read(decided, "$.status")).isEqualTo("approved");
        assertThat(JsonPath.<String>read(decided, "$.decidedByName")).isEqualTo("Aishath Shifa");
        assertThat(JsonPath.<List<String>>read(aishath.get("/api/hr/leave-requests?status=approved").body(), "$[*].id")).contains("LR-1043");
    }

    @Test
    void adjustsABalanceWithAReasonAndLogsIt() throws Exception {
        String body = "{\"employeeId\":\"OPR-0021\",\"type\":\"annual\",\"days\":-1.5,\"reason\":\"Took a day off before joining the portal\"}";

        HttpResponse<String> response = aishath.post("/api/hr/balance-adjustments", body);

        assertThat(response.statusCode()).isEqualTo(200);
        String rahim = aishath.get("/api/hr/employees/OPR-0021").body();
        assertThat(JsonPath.<List<Number>>read(rahim, "$.leaveBalances[?(@.type == 'annual')].entitled").getFirst().doubleValue()).isEqualTo(30.5);
        assertThat(JsonPath.<List<String>>read(rahim, "$.adjustments[*].byName")).containsExactly("Aishath Shifa", "Aishath Shifa");
        assertThat(notificationsOf("OPR-0021")).contains("HR removed 1.5 days from your annual leave. Took a day off before joining the portal.");
    }

    @Test
    void neverTakesABalanceBelowWhatIsUsedAndOpensOneTheyDontHold() throws Exception {
        String tooMuch = "{\"employeeId\":\"OPR-0021\",\"type\":\"annual\",\"days\":-30,\"reason\":\"Oops\"}";
        String fresh = "{\"employeeId\":\"OPR-0018\",\"type\":\"maternity\",\"days\":60,\"reason\":\"Expecting\"}";

        assertThat(aishath.post("/api/hr/balance-adjustments", tooMuch).body())
                .isEqualTo("{\"message\":\"That would leave less than they've already taken or booked.\"}");
        assertThat(aishath.post("/api/hr/balance-adjustments", fresh).statusCode()).isEqualTo(200);
        assertThat(JsonPath.<List<String>>read(aishath.get("/api/hr/employees/OPR-0018").body(), "$.leaveBalances[*].type")).contains("maternity");
    }

    @Test
    void changesALeaveType() throws Exception {
        String type = aishath.put("/api/hr/leave-types/annual", "{\"name\":\"Annual leave\",\"allowsHalfDay\":true,\"defaultEntitlement\":32}").body();

        assertThat(JsonPath.<Number>read(type, "$.defaultEntitlement").doubleValue()).isEqualTo(32);
        assertThat(aishath.put("/api/hr/leave-types/nope", "{\"name\":\"X\",\"allowsHalfDay\":true}").statusCode()).isEqualTo(404);
    }

    // Calendar

    @Test
    void confirmingATentativeHolidayTellsEveryone() throws Exception {
        String body = "{\"date\":\"2027-02-09\",\"name\":\"First day of Ramadan\",\"isTentative\":false}";

        aishath.put("/api/hr/holidays/HD-19", body);

        assertThat(notificationsOf("OPR-0018")).contains("First day of Ramadan is confirmed for Tuesday 9 February.");
        assertThat(JsonPath.<List<String>>read(aishath.get("/api/holidays?year=2027").body(), "$[?(@.id == 'HD-19')].date")).containsExactly("2027-02-09");
    }

    @Test
    void startsAnEmptyYearWithTheCivilHolidaysOnce() throws Exception {
        String added = aishath.post("/api/hr/holidays/start-year", "{\"year\":2028}").body();

        assertThat(JsonPath.<List<String>>read(added, "$[*].name")).containsExactly("New Year's Day", "Independence Day", "Victory Day", "Republic Day");
        assertThat(JsonPath.<List<String>>read(aishath.post("/api/hr/holidays/start-year", "{\"year\":2028}").body(), "$")).isEmpty();
    }

    @Test
    void addsEditsAndRemovesHolidaysAndEvents() throws Exception {
        String holiday = JsonPath.read(aishath.post("/api/hr/holidays", "{\"date\":\"2026-12-24\",\"name\":\"Office closed\",\"isTentative\":false}").body(), "$.id");
        String event = JsonPath.read(aishath.post("/api/hr/events", "{\"date\":\"2026-12-17\",\"name\":\"Year end dinner\"}").body(), "$.id");

        aishath.put("/api/hr/events/" + event, "{\"date\":\"2026-12-18\",\"name\":\"Year end dinner\"}");
        assertThat(JsonPath.<List<String>>read(aishath.get("/api/events?year=2026").body(), "$[?(@.id == '" + event + "')].date")).containsExactly("2026-12-18");

        assertThat(aishath.delete("/api/hr/holidays/" + holiday).statusCode()).isEqualTo(204);
        assertThat(aishath.delete("/api/hr/events/" + event).statusCode()).isEqualTo(204);
        assertThat(aishath.delete("/api/hr/events/" + event).statusCode()).isEqualTo(404);
    }

    // Attendance

    @Test
    void addsAMissingPunchAndVoidsAWrongOneWithALog() throws Exception {
        String add = "{\"employeeId\":\"OPR-0018\",\"date\":\"2026-11-10\",\"action\":\"add\",\"time\":\"08:55\",\"reason\":\"Device missed him\"}";

        assertThat(aishath.post("/api/hr/punch-edits", add).statusCode()).isEqualTo(200);
        assertThat(aishath.post("/api/hr/punch-edits", add).statusCode()).isEqualTo(409);
        String day = aishath.get("/api/hr/attendance?employeeId=OPR-0018&month=2026-11").body();
        assertThat(JsonPath.<List<Boolean>>read(day, "$[?(@.date == '2026-11-10')].isCorrected")).containsExactly(true);
        assertThat(JsonPath.<List<String>>read(day, "$[?(@.date == '2026-11-10')].punches[*].direction")).containsExactly("in");

        aishath.post("/api/hr/punch-edits", add.replace("add", "void").replace("Device missed him", "Wrong person"));

        String log = aishath.get("/api/hr/punch-edits?employeeId=OPR-0018&month=2026-11").body();
        assertThat(JsonPath.<List<String>>read(log, "$[*].action")).containsExactlyInAnyOrder("add", "void");
        assertThat(JsonPath.<List<String>>read(log, "$[*].time")).containsExactly("08:55", "08:55");
        assertThat(JsonPath.<List<String>>read(log, "$[*].byName")).containsExactly("Aishath Shifa", "Aishath Shifa");
        assertThat(jdbc.queryForObject("select voided_by from punch", String.class)).isEqualTo("OPR-0002");
        assertThat(notificationsOf("OPR-0018")).contains("HR added a punch at 8:55 AM on Tuesday 10 November. Device missed him.");
    }

    @Test
    void refusesPunchFixesForDaysToComeAndBadMonths() throws Exception {
        String future = "{\"employeeId\":\"OPR-0018\",\"date\":\"2026-11-20\",\"action\":\"add\",\"time\":\"09:00\",\"reason\":\"Early\"}";

        assertThat(aishath.post("/api/hr/punch-edits", future).statusCode()).isEqualTo(400);
        assertThat(aishath.get("/api/hr/attendance?employeeId=OPR-0018&month=November").body()).isEqualTo("{\"message\":\"Month must look like 2026-11\"}");
    }

    @Test
    void addsAFutureScheduleAndCancelsIt() throws Exception {
        String body = """
                {"effectiveFrom":"2027-01-03","shiftStart":"08:30","shiftEnd":"16:30","graceMinutes":10,"halfDayMinutes":240,
                 "ramadanStart":"09:00","ramadanEnd":"14:00","reason":"Earlier hours from the new year"}""";

        String version = aishath.post("/api/hr/schedules", body).body();
        assertThat(JsonPath.<String>read(version, "$.shiftStart")).isEqualTo("08:30");
        assertThat(JsonPath.<String>read(version, "$.setByName")).isEqualTo("Aishath Shifa");
        assertThat(aishath.post("/api/hr/schedules", body).statusCode()).isEqualTo(409);
        assertThat(JsonPath.<List<String>>read(aishath.get("/api/hr/schedules").body(), "$[*].effectiveFrom")).containsExactly("2027-01-03", "2024-01-01");

        assertThat(aishath.delete("/api/hr/schedules/" + JsonPath.read(version, "$.id")).statusCode()).isEqualTo(204);
        assertThat(aishath.delete("/api/hr/schedules/WS-1").statusCode()).isEqualTo(409);
    }

    @Test
    void aScheduleStartsAfterTodayAndMakesSense() throws Exception {
        String body = """
                {"effectiveFrom":"%s","shiftStart":"09:00","shiftEnd":"%s","graceMinutes":15,"halfDayMinutes":240,
                 "ramadanStart":"09:00","ramadanEnd":"14:00","reason":"Test"}""";

        assertThat(aishath.post("/api/hr/schedules", body.formatted("2026-11-12", "17:00")).body())
                .isEqualTo("{\"message\":\"A new schedule can only start after today.\"}");
        assertThat(aishath.post("/api/hr/schedules", body.formatted("2027-01-03", "08:00")).body())
                .isEqualTo("{\"message\":\"A shift has to end after it starts.\"}");
    }

    // Inbox and announcements

    @Test
    void decliningAChangeRequestNeedsAReasonTheEmployeeSees() throws Exception {
        assertThat(aishath.post("/api/hr/change-requests/CR-11/decision", "{\"decision\":\"declined\"}").statusCode()).isEqualTo(400);

        String declined = aishath.post("/api/hr/change-requests/CR-11/decision", "{\"decision\":\"declined\",\"note\":\"Send it from your work phone\"}").body();

        assertThat(JsonPath.<String>read(declined, "$.status")).isEqualTo("declined");
        assertThat(JsonPath.<String>read(declined, "$.employeeName")).isEqualTo("Kasun Perera");
        assertThat(notificationsOf("OPR-0018")).contains("HR couldn't change your phone number: Send it from your work phone.");
        assertThat(aishath.post("/api/hr/change-requests/CR-11/decision", "{\"decision\":\"done\"}").statusCode()).isEqualTo(409);
    }

    @Test
    void theInboxNamesWhoAsked() throws Exception {
        String inbox = aishath.get("/api/hr/change-requests").body();

        assertThat(JsonPath.<List<String>>read(inbox, "$[*].id")).containsExactly("CR-11", "CR-10");
        assertThat(JsonPath.<List<String>>read(inbox, "$[*].employeeName")).containsExactly("Kasun Perera", "Priya Nair");
    }

    @Test
    void aNewAnnouncementTellsEveryoneAndEditsDoNot() throws Exception {
        String posted = aishath.post("/api/hr/announcements", "{\"title\":\"Office closed on 24 December\",\"body\":\"Enjoy the long weekend.\"}").body();
        String id = JsonPath.read(posted, "$.id");

        aishath.put("/api/hr/announcements/" + id, "{\"title\":\"Office closed on 24 December\",\"body\":\"Enjoy the long weekend, everyone.\"}");

        assertThat(notificationsOf("OPR-0018")).containsOnlyOnce("Office closed on 24 December");
        assertThat(JsonPath.<List<String>>read(aishath.get("/api/announcements").body(), "$[?(@.id == '" + id + "')].body"))
                .containsExactly("Enjoy the long weekend, everyone.");
        assertThat(aishath.delete("/api/hr/announcements/" + id).statusCode()).isEqualTo(204);
        assertThat(JsonPath.<List<String>>read(aishath.get("/api/announcements").body(), "$[*].id")).doesNotContain(id);
    }
}
