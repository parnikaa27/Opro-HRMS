package mv.opro.hrms;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalServerPort;

// The API docs are served in development, with every part of the API tagged.
@ApiTest
class ApiDocsTests {

    @LocalServerPort
    int port;

    @Test
    void theSpecCoversTheApiWithoutSigningIn() throws Exception {
        String spec = new ApiClient(port).get("/v3/api-docs").body();

        assertThat(JsonPath.<String>read(spec, "$.info.title")).isEqualTo("Opro HRMS API");
        assertThat(JsonPath.<Map<String, Object>>read(spec, "$.paths"))
                .containsKeys("/api/me", "/api/leave/requests", "/api/{scope}/leave-requests/{id}/decision", "/api/hr/documents",
                        "/api/documents/{type}/file");
        assertThat(JsonPath.<List<String>>read(spec, "$.tags[*].name")).contains("Leave", "HR: documents", "Team and company");
    }
}
