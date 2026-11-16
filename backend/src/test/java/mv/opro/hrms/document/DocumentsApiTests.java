package mv.opro.hrms.document;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import mv.opro.hrms.ApiClient;
import mv.opro.hrms.ApiTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

// Arjun (OPR-0018) is Indian, Sneha (OPR-0011) Maldivian, Ananya (OPR-0002) HR. Today is 12 November 2026.
// Employees upload their passport copy, National ID and certificates; HR adds the contract, visa copy and insurance.
@ApiTest
class DocumentsApiTests {

    private static final byte[] PDF = "%PDF-1.4 passport".getBytes(StandardCharsets.US_ASCII);
    private static final String PDF_TYPE = "application/pdf";
    private static final int SEEDED_NOTIFICATIONS = 7;

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient arjun;
    ApiClient ananya;

    @BeforeEach
    void signIn() throws Exception {
        arjun = as("OPR-0018");
        ananya = as("OPR-0002");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from employee_document where id like 'DOC-%'");
        jdbc.update("update employee_document set expires_on = '2026-12-20' where id = 'OPR-0018-visa'");
        jdbc.update("delete from document_type where code not in ('employment-contract', 'national-id', 'health-insurance', 'visa-copy', 'passport-copy', "
                + "'educational-certificates')");
        jdbc.update("update document_type set retired_on = null");
        jdbc.update("delete from stored_file where id not in (select file_id from employee_document where file_id is not null)");
        jdbc.update("delete from notification where id > ?", SEEDED_NOTIFICATIONS);
    }

    private ApiClient as(String employeeId) throws Exception {
        ApiClient client = new ApiClient(port);
        client.signIn(employeeId);
        return client;
    }

    private HttpResponse<String> uploadCertificates() throws Exception {
        return arjun.put("/api/documents/educational-certificates/file", PDF, PDF_TYPE);
    }

    private String statusOf(ApiClient client, String type) throws Exception {
        return JsonPath.<List<String>>read(client.get("/api/documents").body(), "$[?(@.type == '" + type + "')].status").getFirst();
    }

    @Test
    void anEmployeesUploadWaitsForHr() throws Exception {
        String sent = arjun.put("/api/documents/national-id/file", PDF, PDF_TYPE).body();

        assertThat(JsonPath.<String>read(sent, "$.status")).isEqualTo("pending");
        String waiting = ananya.get("/api/hr/documents").body();
        assertThat(JsonPath.<List<String>>read(waiting, "$[?(@.type == 'national-id')].employeeName")).containsExactly("Arjun Reddy");
        assertThat(arjun.getBytes("/api/documents/national-id/file").statusCode()).isEqualTo(200);
    }

    @Test
    void anExpiringDocumentNeedsAFutureDateAndHrsOwnTypesAreRefused() throws Exception {
        // Vikram has no passport copy on file yet.
        ApiClient vikram = as("OPR-0004");
        assertThat(vikram.put("/api/documents/passport-copy/file", PDF, PDF_TYPE).body())
                .isEqualTo("{\"message\":\"Enter the date it expires. It has to be after today.\"}");
        assertThat(vikram.put("/api/documents/passport-copy/file?expiresOn=2026-11-01", PDF, PDF_TYPE).statusCode()).isEqualTo(400);
        assertThat(JsonPath.<String>read(vikram.put("/api/documents/passport-copy/file?expiresOn=2031-06-30", PDF, PDF_TYPE).body(), "$.expiresOn"))
                .isEqualTo("2031-06-30");

        HttpResponse<String> contract = arjun.put("/api/documents/employment-contract/file", PDF, PDF_TYPE);
        assertThat(contract.statusCode()).isEqualTo(403);
        assertThat(contract.body()).isEqualTo("{\"message\":\"HR adds your employment contract.\"}");
        assertThat(arjun.put("/api/documents/educational-certificates/file", "not a pdf".getBytes(StandardCharsets.US_ASCII), PDF_TYPE).statusCode())
                .isEqualTo(415);
    }

    @Test
    void hrSendsOneBackWithAReasonThenVerifiesTheNewCopy() throws Exception {
        uploadCertificates();
        String decision = "/api/hr/employees/OPR-0018/documents/educational-certificates/decision";

        assertThat(ananya.post(decision, "{\"decision\":\"rejected\"}").statusCode()).isEqualTo(400);
        ananya.post(decision, "{\"decision\":\"rejected\",\"note\":\"Page two is missing\"}");
        assertThat(statusOf(arjun, "educational-certificates")).isEqualTo("rejected");
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/notifications").body(), "$[*].text"))
                .contains("HR sent back your educational certificates: Page two is missing. Upload it again from Documents.");

        uploadCertificates();
        assertThat(statusOf(arjun, "educational-certificates")).isEqualTo("pending");
        assertThat(JsonPath.<String>read(ananya.post(decision, "{\"decision\":\"verified\"}").body(), "$.status")).isEqualTo("verified");
        assertThat(ananya.post(decision, "{\"decision\":\"verified\"}").statusCode()).isEqualTo(409);
        assertThat(jdbc.queryForObject("select count(*) from stored_file where uploaded_by = 'OPR-0018'", Integer.class)).isEqualTo(1);
    }

    @Test
    void hrUploadsForSomeoneAsVerifiedButNeverForThemselves() throws Exception {
        String added = ananya.put("/api/hr/employees/OPR-0018/documents/national-id/file", PDF, PDF_TYPE).body();

        assertThat(JsonPath.<String>read(added, "$.status")).isEqualTo("verified");
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/notifications").body(), "$[*].text")).contains("HR added your national id.");
        assertThat(ananya.getBytes("/api/hr/employees/OPR-0018/documents/national-id/file").statusCode()).isEqualTo(200);
        assertThat(ananya.put("/api/hr/employees/OPR-0002/documents/national-id/file", PDF, PDF_TYPE).statusCode()).isEqualTo(403);
        assertThat(arjun.get("/api/hr/employees/OPR-0018/documents").statusCode()).isEqualTo(403);
    }

    @Test
    void expatriateOnlyTypesSkipMaldiviansAndAnOldCopyShowsExpired() throws Exception {
        assertThat(JsonPath.<List<String>>read(as("OPR-0011").get("/api/documents").body(), "$[*].type")).doesNotContain("passport-copy", "visa-copy");

        jdbc.update("update employee_document set expires_on = '2026-11-01' where id = 'OPR-0018-visa'");

        assertThat(statusOf(arjun, "visa-copy")).isEqualTo("expired");
    }

    @Test
    void hrKeepsTheListAndAUsedTypeIsRetiredNotDeleted() throws Exception {
        String type = "{\"name\":\"Police clearance\",\"uploadedBy\":\"employee\",\"hasExpiry\":false,\"isForExpatriatesOnly\":true}";
        assertThat(JsonPath.<String>read(ananya.post("/api/hr/document-types", type).body(), "$.code")).isEqualTo("police-clearance");
        assertThat(ananya.post("/api/hr/document-types", type).statusCode()).isEqualTo(409);
        assertThat(statusOf(arjun, "police-clearance")).isEqualTo("missing");

        ananya.put("/api/hr/document-types/police-clearance", type.replace("Police clearance", "Police clearance certificate"));
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/documents").body(), "$[*].name")).contains("Police clearance certificate");
        assertThat(ananya.delete("/api/hr/document-types/police-clearance").statusCode()).isEqualTo(204);
        assertThat(JsonPath.<List<String>>read(ananya.get("/api/hr/document-types").body(), "$[*].code")).doesNotContain("police-clearance");

        ananya.delete("/api/hr/document-types/passport-copy");
        assertThat(JsonPath.<List<String>>read(ananya.get("/api/hr/document-types").body(), "$[?(@.code == 'passport-copy')].retiredOn")).containsExactly("2026-11-12");
        assertThat(statusOf(arjun, "passport-copy")).isEqualTo("verified");
        assertThat(arjun.put("/api/documents/passport-copy/file?expiresOn=2031-06-30", PDF, PDF_TYPE).statusCode()).isEqualTo(404);
        assertThat(arjun.post("/api/hr/document-types", type).statusCode()).isEqualTo(403);
    }
}
