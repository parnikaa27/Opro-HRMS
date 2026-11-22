package mv.opro.hrms.onboarding;

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

// Kavya (OPR-0027) joined Vikram's (OPR-0004) team on 1 November and is still onboarding: HR's contract and Vikram's
// laptop are done. Ananya (OPR-0002) is HR; Arjun (OPR-0018) is a colleague. Today is 12 November 2026.
@ApiTest
class OnboardingApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;
    private static final String ITEMS = "/api/onboarding/OPR-0027/items/";

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient kavya;
    ApiClient vikram;
    ApiClient ananya;

    @BeforeEach
    void signIn() throws Exception {
        kavya = as("OPR-0027");
        vikram = as("OPR-0004");
        ananya = as("OPR-0002");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from onboarding_item where employee_id <> 'OPR-0027'");
        jdbc.update("delete from onboarding where employee_id <> 'OPR-0027'");
        jdbc.update("update onboarding_item set done_on = null, done_by = null where id not in ('OI-1', 'OI-3')");
        jdbc.update("update onboarding set completed_on = null, buddy_id = null, first_day_time = '08:45' where employee_id = 'OPR-0027'");
        jdbc.update("delete from onboarding_task where id not like 'OT-_'");
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
    void theJoinerSeesTheirOnboardingAndOthersSeeNone() throws Exception {
        String mine = kavya.get("/api/onboarding").body();

        assertThat(JsonPath.<String>read(mine, "$.firstDayPlace")).isEqualTo("Malé office, 3rd floor reception");
        assertThat(JsonPath.<String>read(mine, "$.hodName")).isEqualTo("Vikram Singh");
        assertThat(JsonPath.<List<String>>read(mine, "$.items[?(@.owner == 'joiner')].name")).containsExactly("Upload your documents", "Read the HR policies");
        assertThat(as("OPR-0018").get("/api/onboarding").statusCode()).isEqualTo(204);
        assertThat(JsonPath.<List<String>>read(vikram.get("/api/team/onboarding").body(), "$[*].employeeId")).containsExactly("OPR-0027");
        assertThat(JsonPath.<List<String>>read(ananya.get("/api/hr/onboarding").body(), "$[*].employeeId")).containsExactly("OPR-0027");
    }

    @Test
    void eachTaskIsTickedByItsOwner() throws Exception {
        assertThat(kavya.post(ITEMS + "OI-5/done", "{}").statusCode()).isEqualTo(200);
        assertThat(kavya.post(ITEMS + "OI-2/done", "{}").body()).isEqualTo("{\"message\":\"HR ticks this one.\"}");
        assertThat(ananya.post(ITEMS + "OI-4/done", "{}").body()).isEqualTo("{\"message\":\"Their HOD ticks this one.\"}");
        assertThat(vikram.post(ITEMS + "OI-6/done", "{}").body()).isEqualTo("{\"message\":\"They tick this one themselves.\"}");
        assertThat(as("OPR-0018").post(ITEMS + "OI-5/done", "{}").statusCode()).isEqualTo(404);

        String ticked = vikram.post(ITEMS + "OI-4/done", "{}").body();

        assertThat(JsonPath.<List<String>>read(ticked, "$.items[?(@.id == 'OI-4')].doneByName")).containsExactly("Vikram Singh");
    }

    @Test
    void ticksTheLastTaskAndItsDoneUntilOneIsUnticked() throws Exception {
        ananya.post(ITEMS + "OI-2/done", "{}");
        vikram.post(ITEMS + "OI-4/done", "{}");
        kavya.post(ITEMS + "OI-5/done", "{}");
        String done = kavya.post(ITEMS + "OI-6/done", "{}").body();

        assertThat(JsonPath.<String>read(done, "$.completedOn")).isEqualTo("2026-11-12");
        assertThat(notificationsOf(kavya)).contains("Your onboarding is done. Welcome to Opro.");
        assertThat(JsonPath.<List<String>>read(ananya.get("/api/hr/onboarding").body(), "$[*].employeeId")).isEmpty();

        String reopened = kavya.delete(ITEMS + "OI-6/done").body();
        assertThat(reopened).doesNotContain("completedOn");
    }

    @Test
    void hrSetsTheFirstDayAndTheHodPicksABuddy() throws Exception {
        ananya.put("/api/hr/employees/OPR-0027/onboarding/first-day", "{\"time\":\"09:00\",\"place\":\"Hulhumalé site office\",\"contact\":\"Vikram Singh\"}");
        assertThat(JsonPath.<String>read(kavya.get("/api/onboarding").body(), "$.firstDayTime")).isEqualTo("09:00");
        assertThat(ananya.put("/api/hr/employees/OPR-0027/onboarding/first-day", "{\"time\":\"9am\"}").statusCode()).isEqualTo(400);
        assertThat(ananya.put("/api/hr/employees/OPR-0002/onboarding/first-day", "{\"time\":\"09:00\"}").statusCode()).isEqualTo(403);

        assertThat(vikram.put("/api/team/onboarding/OPR-0027/buddy", "{\"buddyId\":\"OPR-0027\"}").statusCode()).isEqualTo(400);
        assertThat(as("OPR-0018").put("/api/team/onboarding/OPR-0027/buddy", "{\"buddyId\":\"OPR-0018\"}").statusCode()).isEqualTo(404);
        String buddy = vikram.put("/api/team/onboarding/OPR-0027/buddy", "{\"buddyId\":\"OPR-0018\"}").body();

        assertThat(JsonPath.<String>read(buddy, "$.buddyName")).isEqualTo("Arjun Reddy");
        assertThat(notificationsOf(as("OPR-0018"))).contains("Vikram Singh asked you to be Kavya Menon's buddy. Show them around in their first weeks.");
        assertThat(notificationsOf(kavya)).contains("Arjun Reddy is your buddy. Ask them anything in your first weeks.");
    }

    @Test
    void hiringSomeoneStartsTheirOnboardingFromHrsList() throws Exception {
        String started = ananya.post("/api/hr/employees/OPR-0011/onboarding", "{}").body();

        // Sneha joined on 1 February 2021; the contract was due a week before.
        assertThat(JsonPath.<List<String>>read(started, "$.items[*].name")).hasSize(8);
        assertThat(JsonPath.<List<String>>read(started, "$.items[?(@.name == 'Contract signed and on file')].dueOn")).containsExactly("2021-01-25");
        assertThat(notificationsOf(vikram)).contains("Sneha Kulkarni joins your team on 1 February 2021. You have 2 onboarding tasks on your Team overview.");
        assertThat(ananya.post("/api/hr/employees/OPR-0011/onboarding", "{}").statusCode()).isEqualTo(409);
    }

    @Test
    void hrKeepsTheTaskList() throws Exception {
        String added = ananya.post("/api/hr/onboarding-tasks", "{\"name\":\"Meet the director\",\"owner\":\"hod\",\"dueInDays\":5}").body();
        assertThat(JsonPath.<String>read(added, "$.owner")).isEqualTo("hod");
        assertThat(ananya.post("/api/hr/onboarding-tasks", "{\"name\":\"Too far\",\"owner\":\"hr\",\"dueInDays\":200}").statusCode()).isEqualTo(400);
        assertThat(ananya.post("/api/hr/onboarding-tasks", "{\"name\":\"Who\",\"owner\":\"it\",\"dueInDays\":1}").statusCode()).isEqualTo(400);

        assertThat(ananya.delete("/api/hr/onboarding-tasks/" + JsonPath.read(added, "$.id")).statusCode()).isEqualTo(204);
        assertThat(kavya.get("/api/hr/onboarding-tasks").statusCode()).isEqualTo(403);
    }
}
