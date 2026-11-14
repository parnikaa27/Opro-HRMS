package mv.opro.hrms;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.net.http.HttpResponse;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

@ApiTest
class SessionTests {

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient client;

    @BeforeEach
    void freshBrowser() {
        client = new ApiClient(port);
    }

    @Test
    void signedOutVisitorsGetAJsonAnswerNotARedirect() throws Exception {
        HttpResponse<String> response = client.get("/api/me");

        assertThat(response.statusCode()).isEqualTo(401);
        assertThat(response.body()).isEqualTo("{\"message\":\"Please sign in\"}");
        assertThat(response.headers().firstValue("Content-Type")).hasValue("application/json;charset=UTF-8");
        assertThat(response.headers().allValues("Set-Cookie")).noneMatch(cookie -> cookie.startsWith("opro_session="));
    }

    @Test
    void thePickerListsEveryoneWithRolesWorkedOutFromReportingLines() throws Exception {
        HttpResponse<String> response = client.get("/api/session/users");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<List<String>>read(response.body(), "$[?(@.id == 'OPR-0004')].roles[*]")).containsExactly("EMPLOYEE", "MANAGER");
        assertThat(JsonPath.<List<String>>read(response.body(), "$[?(@.id == 'OPR-0002')].roles[*]")).containsExactly("EMPLOYEE", "HR");
        assertThat(JsonPath.<List<String>>read(response.body(), "$[?(@.id == 'OPR-0018')].roles[*]")).containsExactly("EMPLOYEE");
        assertThat(response.headers().allValues("Set-Cookie")).anyMatch(cookie -> cookie.startsWith("XSRF-TOKEN=") && cookie.contains("SameSite=Strict"));
    }

    @Test
    void signingInNeedsTheXsrfToken() throws Exception {
        client.get("/api/session/users");

        HttpResponse<String> response = client.postWithoutXsrf("/api/session/login", "{\"employeeId\":\"OPR-0018\"}");

        assertThat(response.statusCode()).isEqualTo(403);
    }

    @Test
    void theSessionCookieIsHttpOnlyAndStrict() throws Exception {
        HttpResponse<String> response = client.signIn("OPR-0018");

        assertThat(response.statusCode()).isEqualTo(204);
        assertThat(response.headers().allValues("Set-Cookie"))
                .anyMatch(cookie -> cookie.startsWith("opro_session=") && cookie.contains("HttpOnly") && cookie.contains("SameSite=Strict"));
    }

    @Test
    void anExpatSeesTheirVisaWithOnlyTheLastFourPassportCharacters() throws Exception {
        client.signIn("OPR-0018");

        String me = client.get("/api/me").body();

        assertThat(JsonPath.<String>read(me, "$.fullName")).isEqualTo("Kasun Perera");
        assertThat(JsonPath.<List<String>>read(me, "$.roles")).containsExactly("EMPLOYEE");
        assertThat(JsonPath.<String>read(me, "$.visa.passportLast4")).isEqualTo("7730");
        assertThat(JsonPath.<String>read(me, "$.visa.visaExpiry")).isEqualTo("2026-12-20");
        assertThat(JsonPath.<String>read(me, "$.emergencyContact.relation")).isEqualTo("Spouse");
    }

    @Test
    void aMaldivianHasNoVisaFieldAtAll() throws Exception {
        client.signIn("OPR-0011");

        String me = client.get("/api/me").body();

        assertThat(me).doesNotContain("\"visa\"");
    }

    @Test
    void unknownPeopleCannotSignIn() throws Exception {
        HttpResponse<String> response = client.signIn("OPR-9999");

        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(response.body()).isEqualTo("{\"message\":\"Unknown employee\"}");
    }

    @Test
    void someonePastTheirLastDayCanNoLongerSignInOrUseTheirSession() throws Exception {
        client.signIn("OPR-0027");
        jdbc.update("update employee set last_day = date '2020-01-01' where id = 'OPR-0027'");
        try {
            assertThat(client.get("/api/me").statusCode()).isEqualTo(401);
            assertThat(new ApiClient(port).signIn("OPR-0027").statusCode()).isEqualTo(400);
        } finally {
            jdbc.update("update employee set last_day = null where id = 'OPR-0027'");
        }
    }

    @Test
    void aMissingEndpointIsA404NotAServerError() throws Exception {
        client.signIn("OPR-0018");

        HttpResponse<String> response = client.get("/api/nothing-here");

        assertThat(response.statusCode()).isEqualTo(404);
        assertThat(response.body()).isEqualTo("{\"message\":\"No such endpoint\"}");
    }

    @Test
    void signingOutEndsTheSession() throws Exception {
        client.signIn("OPR-0018");

        HttpResponse<String> response = client.post("/api/session/logout", "{}");

        assertThat(response.statusCode()).isEqualTo(204);
        assertThat(client.get("/api/me").statusCode()).isEqualTo(401);
    }
}
