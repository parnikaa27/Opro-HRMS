package mv.opro.hrms.performance;

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

// The dev seed opens "2026 appraisals": Arjun's (OPR-0018) plan is approved, with an entry in each section, Rohit's (OPR-0021) wait for
// Vikram (OPR-0004), and Karan (OPR-0023) is appraised. All three are Vikram's. Kavya (OPR-0027), also his, is on probation until
// 20 December and hasn't started. Ananya (OPR-0002) is HR. Today is Thursday 12 November 2026.
@ApiTest
class PerformanceApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;
    private static final String TWO_GOALS = """
            {"goals":[{"title":"Hand over phase 2","measure":"Snag list closed","weight":60},{"title":"Fewer incidents","measure":"None lost time","weight":40}]}""";

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
        jdbc.update("delete from appraisal where id <> 'AP-1'");
        jdbc.update("delete from goal where id not in ('GL-1', 'GL-2', 'GL-3', 'GL-4', 'GL-5', 'GL-6')");
        jdbc.update("delete from appraisal_form where employee_id not in ('OPR-0018', 'OPR-0023', 'OPR-0021')");
        jdbc.update("update appraisal_form set status = 'submitted', hod_approved_by = null, hod_approved_on = null, decided_by = null, "
                + "decided_on = null, note = null where employee_id = 'OPR-0021'");
        jdbc.update("update appraisal_form set status = 'approved' where employee_id = 'OPR-0018'");
        jdbc.update("delete from performance_entry where employee_id <> 'OPR-0018'");
        jdbc.update("update goal set rating = null, comment = null where id in ('GL-1', 'GL-2')");
        jdbc.update("delete from appraisal_cycle where id <> 'AY-2026'");
        jdbc.update("update appraisal_cycle set closed_on = null");
        jdbc.update("delete from probation_review");
        jdbc.update("update employee set probation_ends_on = '2026-12-20' where id = 'OPR-0027'");
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

    private String appraisalOfArjun(String goals) {
        return """
                {"rating":3,"comments":"Solid year on site.","recommendsPromotion":false,"goals":%s,"selfReviewComment":"Book the NEBOSH course in January."}""".formatted(goals);
    }

    @Test
    void hrOpensOneCycleAtATimeAndHodsAreAsked() throws Exception {
        assertThat(ananya.post("/api/hr/appraisal-cycles", "{\"name\":\"Mid year\",\"dueOn\":\"2027-02-28\"}").statusCode()).isEqualTo(409);
        assertThat(vikram.post("/api/hr/appraisal-cycles", "{\"name\":\"Mid year\",\"dueOn\":\"2027-02-28\"}").statusCode()).isEqualTo(403);

        ananya.post("/api/hr/appraisal-cycles/AY-2026/close", "{}");
        assertThat(ananya.post("/api/hr/appraisal-cycles", "{\"name\":\"Mid year\",\"dueOn\":\"2026-11-01\"}").statusCode()).isEqualTo(400);
        String opened = ananya.post("/api/hr/appraisal-cycles", "{\"name\":\"Mid year\",\"dueOn\":\"2027-02-28\"}").body();

        assertThat(JsonPath.<String>read(opened, "$.name")).isEqualTo("Mid year");
        assertThat(notificationsOf(vikram)).contains("HR opened Mid year, due 28 February 2027. Approve your team's plans, then appraise them.");
        assertThat(notificationsOf(as("OPR-0018"))).contains("HR opened Mid year, due 28 February 2027. Write your plan on Performance and send it to your HOD.");
    }

    @Test
    void theHodSeesTheirTeamsGoalsAndAppraisals() throws Exception {
        String team = vikram.get("/api/team/performance").body();

        assertThat(JsonPath.<String>read(team, "$.cycle.name")).isEqualTo("2026 appraisals");
        assertThat(JsonPath.<List<String>>read(team, "$.people[?(@.employeeId == 'OPR-0018')].goals[*].title"))
                .containsExactly("Hand over phase 2 of the Hulhumalé site", "Fewer site incidents");
        assertThat(JsonPath.<List<Integer>>read(team, "$.people[?(@.employeeId == 'OPR-0023')].appraisal.rating")).containsExactly(4);
        assertThat(as("OPR-0018").get("/api/team/performance").statusCode()).isEqualTo(403);
    }

    @Test
    void theEmployeeWritesGoalsWeightedToAHundredAndSendsThemToTheirHod() throws Exception {
        ApiClient kavya = as("OPR-0027");
        String uneven = TWO_GOALS.replace("\"weight\":40", "\"weight\":30");
        assertThat(kavya.put("/api/performance/goals", uneven).body()).isEqualTo("{\"message\":\"Goal weights need to add up to 100%.\"}");
        assertThat(kavya.post("/api/performance/submit", "{}").body()).isEqualTo("{\"message\":\"Add at least one goal first.\"}");

        assertThat(JsonPath.<List<Integer>>read(kavya.put("/api/performance/goals", TWO_GOALS).body(), "$[*].weight")).containsExactly(60, 40);
        assertThat(JsonPath.<String>read(kavya.post("/api/performance/submit", "{}").body(), "$.status")).isEqualTo("submitted");

        assertThat(kavya.put("/api/performance/goals", TWO_GOALS).statusCode()).isEqualTo(409);
        assertThat(notificationsOf(vikram)).contains("Kavya Menon sent their plan for 2026 appraisals. Approve it or send it back from Performance.");
        assertThat(as("OPR-0001").put("/api/performance/goals", TWO_GOALS).body()).isEqualTo("{\"message\":\"You have no HOD to appraise you.\"}");
    }

    @Test
    void theHodApprovesThenHrAndASentBackOneCanBeChanged() throws Exception {
        String decision = "/api/team/performance/OPR-0021/decision";
        assertThat(vikram.post(decision, "{\"decision\":\"rejected\"}").statusCode()).isEqualTo(400);
        vikram.post(decision, "{\"decision\":\"rejected\",\"note\":\"Add a customs goal\"}");
        ApiClient rohit = as("OPR-0021");
        assertThat(notificationsOf(rohit))
                .contains("Vikram Singh sent back your plan for 2026 appraisals: Add a customs goal. Change it on Performance and send it again.");

        rohit.put("/api/performance/goals", TWO_GOALS);
        rohit.post("/api/performance/submit", "{}");
        assertThat(vikram.post(decision, "{\"decision\":\"approved\"}").statusCode()).isEqualTo(204);
        assertThat(JsonPath.<List<String>>read(ananya.get("/api/hr/performance").body(), "$.people[?(@.employeeId == 'OPR-0021')].form.status"))
                .containsExactly("hod-approved");
        assertThat(vikram.post(decision, "{\"decision\":\"approved\"}").statusCode()).isEqualTo(409);

        assertThat(ananya.post("/api/hr/performance/OPR-0021/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(204);
        assertThat(JsonPath.<String>read(rohit.get("/api/performance").body(), "$.form.status")).isEqualTo("approved");
        assertThat(notificationsOf(rohit)).contains("Your plan for 2026 appraisals is approved.");
    }

    @Test
    void eachSectionHoldsAsManyEntriesAsTheyLikeUntilThePlanIsSent() throws Exception {
        ApiClient kavya = as("OPR-0027");
        String certifications = """
                {"entries":[{"title":"PMP","details":"Through the Malé chapter","targetOn":"2027-06-30"},{"title":"ITIL Foundation"}]}""";

        String saved = kavya.put("/api/performance/sections/certification", certifications).body();
        kavya.put("/api/performance/sections/strength", "{\"entries\":[{\"title\":\"Patience\",\"targetOn\":\"2027-01-01\"}]}");

        assertThat(JsonPath.<List<String>>read(saved, "$[*].title")).containsExactly("PMP", "ITIL Foundation");
        String mine = kavya.get("/api/performance").body();
        assertThat(JsonPath.<List<String>>read(mine, "$.entries[?(@.section == 'certification')].targetOn")).containsExactly("2027-06-30");
        assertThat(JsonPath.<List<Object>>read(mine, "$.entries[?(@.section == 'strength')].targetOn")).isEmpty();
        assertThat(kavya.put("/api/performance/sections/hobbies", certifications).statusCode()).isEqualTo(404);
        assertThat(kavya.put("/api/performance/sections/strength", "{\"entries\":[{\"title\":\"\"}]}").statusCode()).isEqualTo(400);

        kavya.put("/api/performance/goals", TWO_GOALS);
        kavya.post("/api/performance/submit", "{}");
        assertThat(kavya.put("/api/performance/sections/strength", "{\"entries\":[]}").statusCode()).isEqualTo(409);
        assertThat(JsonPath.<List<String>>read(vikram.get("/api/team/performance").body(), "$.people[?(@.employeeId == 'OPR-0027')].entries[*].title"))
                .containsExactly("PMP", "ITIL Foundation", "Patience");
    }

    @Test
    void aSuperAdminStandsInForTheHodButNeverForThemselves() throws Exception {
        ApiClient rajesh = as("OPR-0001");

        String everyone = rajesh.get("/api/company/performance").body();
        assertThat(JsonPath.<List<String>>read(everyone, "$.people[?(@.employeeId == 'OPR-0021')].managerName")).containsExactly("Vikram Singh");
        assertThat(JsonPath.<List<String>>read(everyone, "$.people[*].employeeId")).doesNotContain("OPR-0001");

        assertThat(rajesh.post("/api/company/performance/OPR-0021/decision", "{\"decision\":\"approved\"}").statusCode()).isEqualTo(204);
        assertThat(notificationsOf(as("OPR-0021"))).contains("Rajesh Sharma approved your plan for 2026 appraisals. It now waits for HR.");
        assertThat(vikram.get("/api/company/performance").statusCode()).isEqualTo(403);
    }

    @Test
    void anAppraisalRatesEveryGoalOnceAndThePersonAcceptsIt() throws Exception {
        assertThat(vikram.post("/api/team/performance/OPR-0021/appraisal", appraisalOfArjun("[]")).body())
                .isEqualTo("{\"message\":\"Their plan needs approving by their HOD and HR first.\"}");
        assertThat(vikram.post("/api/team/performance/OPR-0018/appraisal", appraisalOfArjun("[{\"goalId\":\"GL-1\",\"rating\":4}]")).statusCode()).isEqualTo(400);

        String saved = vikram.post("/api/team/performance/OPR-0018/appraisal", appraisalOfArjun(
                "[{\"goalId\":\"GL-1\",\"rating\":4,\"comment\":\"Handed over early\"},{\"goalId\":\"GL-2\",\"rating\":2}]")).body();

        assertThat(JsonPath.<List<Integer>>read(saved, "$.goals[*].rating")).containsExactly(4, 2);
        assertThat(JsonPath.<String>read(saved, "$.selfReviewComment")).isEqualTo("Book the NEBOSH course in January.");
        assertThat(vikram.post("/api/team/performance/OPR-0018/appraisal", appraisalOfArjun("[]")).statusCode()).isEqualTo(409);

        ApiClient arjun = as("OPR-0018");
        assertThat(notificationsOf(arjun)).contains("Vikram Singh finished your 2026 appraisals. Read it on Performance and accept your rating.");
        String id = JsonPath.read(saved, "$.id");
        assertThat(JsonPath.<String>read(arjun.post("/api/performance/appraisals/" + id + "/accept", "{}").body(), "$.acceptedOn")).isEqualTo("2026-11-12");
        assertThat(as("OPR-0021").post("/api/performance/appraisals/" + id + "/accept", "{}").statusCode()).isEqualTo(404);
    }

    @Test
    void employeesSeeTheirOwnGoalsAndAppraisalsButNotTheRecommendations() throws Exception {
        String karan = as("OPR-0023").get("/api/performance").body();

        assertThat(JsonPath.<List<String>>read(karan, "$.goals[*].id")).containsExactly("GL-3", "GL-4");
        assertThat(JsonPath.<String>read(karan, "$.form.status")).isEqualTo("approved");
        assertThat(JsonPath.<String>read(karan, "$.appraisals[0].appraisedByName")).isEqualTo("Vikram Singh");
        assertThat(karan).doesNotContain("recommendsPromotion", "incrementPercent");
    }

    @Test
    void aProbationReviewConfirmsOrExtendsAndTellsHr() throws Exception {
        String early = "{\"outcome\":\"extended\",\"extendedTo\":\"2026-12-01\",\"comments\":\"More time on the new system\"}";
        assertThat(vikram.post("/api/team/performance/OPR-0027/probation-review", early).statusCode()).isEqualTo(400);

        vikram.post("/api/team/performance/OPR-0027/probation-review", early.replace("2026-12-01", "2027-03-20"));
        assertThat(jdbc.queryForObject("select probation_ends_on::text from employee where id = 'OPR-0027'", String.class)).isEqualTo("2027-03-20");

        vikram.post("/api/team/performance/OPR-0027/probation-review", "{\"outcome\":\"confirmed\",\"comments\":\"Settled in well\"}");
        assertThat(jdbc.queryForObject("select probation_ends_on from employee where id = 'OPR-0027'", String.class)).isNull();
        assertThat(notificationsOf(as("OPR-0027"))).contains("Vikram Singh reviewed your probation: you're confirmed in your role.");
        assertThat(notificationsOf(ananya)).contains("Vikram Singh reviewed Kavya Menon's probation: on probation until 20 March 2027.");
        assertThat(vikram.post("/api/team/performance/OPR-0027/probation-review", "{\"outcome\":\"confirmed\",\"comments\":\"Again\"}").statusCode()).isEqualTo(409);
    }

    @Test
    void hrSeesHowFarTheCycleHasGotWithRecommendations() throws Exception {
        String overview = ananya.get("/api/hr/performance").body();

        assertThat(JsonPath.<List<String>>read(overview, "$.cycles[*].name")).containsExactly("2026 appraisals");
        assertThat(JsonPath.<List<Double>>read(overview, "$.people[?(@.employeeId == 'OPR-0023')].appraisal.incrementPercent")).containsExactly(8.0);
        assertThat(JsonPath.<List<String>>read(overview, "$.people[?(@.employeeId == 'OPR-0018')].goals[*].id")).containsExactly("GL-1", "GL-2");
        assertThat(JsonPath.<List<String>>read(overview, "$.people[?(@.employeeId == 'OPR-0018')].entries[?(@.section == 'certification')].title"))
                .containsExactly("NEBOSH International General Certificate by June.");
        assertThat(JsonPath.<List<String>>read(overview, "$.people[*].employeeId")).doesNotContain("OPR-0001");
        assertThat(vikram.get("/api/hr/performance").statusCode()).isEqualTo(403);
    }
}
