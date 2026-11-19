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

// The dev seed opens "2026 appraisals" with goals for Arjun (OPR-0018) and Karan (OPR-0023) appraised, both Vikram's (OPR-0004).
// Kavya (OPR-0027), also Vikram's, is on probation until 20 December. Ananya (OPR-0002) is HR. Today is Thursday 12 November 2026.
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
        jdbc.update("delete from goal where id not in ('GL-1', 'GL-2', 'GL-3', 'GL-4')");
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
                {"rating":3,"comments":"Solid year on site.","recommendsPromotion":false,"goals":%s}""".formatted(goals);
    }

    @Test
    void hrOpensOneCycleAtATimeAndHodsAreAsked() throws Exception {
        assertThat(ananya.post("/api/hr/appraisal-cycles", "{\"name\":\"Mid year\",\"dueOn\":\"2027-02-28\"}").statusCode()).isEqualTo(409);
        assertThat(vikram.post("/api/hr/appraisal-cycles", "{\"name\":\"Mid year\",\"dueOn\":\"2027-02-28\"}").statusCode()).isEqualTo(403);

        ananya.post("/api/hr/appraisal-cycles/AY-2026/close", "{}");
        assertThat(ananya.post("/api/hr/appraisal-cycles", "{\"name\":\"Mid year\",\"dueOn\":\"2026-11-01\"}").statusCode()).isEqualTo(400);
        String opened = ananya.post("/api/hr/appraisal-cycles", "{\"name\":\"Mid year\",\"dueOn\":\"2027-02-28\"}").body();

        assertThat(JsonPath.<String>read(opened, "$.name")).isEqualTo("Mid year");
        assertThat(notificationsOf(vikram)).contains("HR opened Mid year, due 28 February 2027. Set your team's goals and appraise them from Performance.");
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
    void goalsAreWeightedToAHundredAndTellThePerson() throws Exception {
        String uneven = TWO_GOALS.replace("\"weight\":40", "\"weight\":30");
        assertThat(vikram.put("/api/team/performance/OPR-0021/goals", uneven).body()).isEqualTo("{\"message\":\"Goal weights need to add up to 100%.\"}");
        assertThat(vikram.put("/api/team/performance/OPR-0002/goals", TWO_GOALS).statusCode()).isEqualTo(404);

        String saved = vikram.put("/api/team/performance/OPR-0021/goals", TWO_GOALS).body();

        assertThat(JsonPath.<List<Integer>>read(saved, "$[*].weight")).containsExactly(60, 40);
        assertThat(notificationsOf(as("OPR-0021"))).contains("Vikram Singh set your goals for 2026 appraisals. See them on Performance.");
    }

    @Test
    void anAppraisalRatesEveryGoalOnceAndThePersonAcknowledgesIt() throws Exception {
        assertThat(vikram.post("/api/team/performance/OPR-0018/appraisal", appraisalOfArjun("[{\"goalId\":\"GL-1\",\"rating\":4}]")).statusCode()).isEqualTo(400);

        String saved = vikram.post("/api/team/performance/OPR-0018/appraisal", appraisalOfArjun(
                "[{\"goalId\":\"GL-1\",\"rating\":4,\"comment\":\"Handed over early\"},{\"goalId\":\"GL-2\",\"rating\":2}]")).body();

        assertThat(JsonPath.<List<Integer>>read(saved, "$.goals[*].rating")).containsExactly(4, 2);
        assertThat(vikram.post("/api/team/performance/OPR-0018/appraisal", appraisalOfArjun("[]")).statusCode()).isEqualTo(409);
        assertThat(vikram.put("/api/team/performance/OPR-0018/goals", TWO_GOALS).statusCode()).isEqualTo(409);

        ApiClient arjun = as("OPR-0018");
        assertThat(notificationsOf(arjun)).contains("Vikram Singh finished your 2026 appraisals. Read it on Performance and let them know you've seen it.");
        String id = JsonPath.read(saved, "$.id");
        assertThat(JsonPath.<String>read(arjun.post("/api/performance/appraisals/" + id + "/acknowledge", "{}").body(), "$.acknowledgedOn")).isEqualTo("2026-11-12");
        assertThat(as("OPR-0021").post("/api/performance/appraisals/" + id + "/acknowledge", "{}").statusCode()).isEqualTo(404);
    }

    @Test
    void employeesSeeTheirOwnGoalsAndAppraisalsButNotTheRecommendations() throws Exception {
        String karan = as("OPR-0023").get("/api/performance").body();

        assertThat(JsonPath.<List<String>>read(karan, "$.goals[*].id")).containsExactly("GL-3", "GL-4");
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
        assertThat(JsonPath.<List<Integer>>read(overview, "$.people[?(@.employeeId == 'OPR-0018')].goalCount")).containsExactly(2);
        assertThat(JsonPath.<List<String>>read(overview, "$.people[*].employeeId")).doesNotContain("OPR-0001");
        assertThat(vikram.get("/api/hr/performance").statusCode()).isEqualTo(403);
    }
}
