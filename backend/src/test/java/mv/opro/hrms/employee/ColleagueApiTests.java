package mv.opro.hrms.employee;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.Map;
import mv.opro.hrms.ApiClient;
import mv.opro.hrms.ApiTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

// Anyone signed in can look up a colleague. Arjun (OPR-0018) has no reports and isn't HR. Today is 12 November 2026.
@ApiTest
class ColleagueApiTests {

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    @AfterEach
    void cleanUp() {
        jdbc.update("update employee set last_day = null, leaving_reason = null");
    }

    @Test
    void anyoneSeesWhoWorksHereWithOnlyWhatAColleagueMaySee() throws Exception {
        jdbc.update("update employee set last_day = '2026-10-31', leaving_reason = 'Moved home' where id = 'OPR-0023'");
        ApiClient arjun = new ApiClient(port);
        arjun.signIn("OPR-0018");

        String people = arjun.get("/api/people").body();

        assertThat(JsonPath.<List<String>>read(people, "$[*].fullName")).contains("Ananya Iyer", "Vikram Singh").doesNotContain("Karan Mehta");
        assertThat(JsonPath.<List<String>>read(people, "$[?(@.id == 'OPR-0002')].email")).containsExactly("ananya.iyer@opro.mv");
        assertThat(JsonPath.<List<Map<String, Object>>>read(people, "$[*]")).allSatisfy(person ->
                assertThat(person.keySet()).isSubsetOf("id", "fullName", "designation", "department", "email", "photoUrl"));
        assertThat(new ApiClient(port).get("/api/people").statusCode()).isEqualTo(401);
    }
}
