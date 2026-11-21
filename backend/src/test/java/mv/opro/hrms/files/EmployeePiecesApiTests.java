package mv.opro.hrms.files;

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

// Downloading documents, announcements, change requests, photos and medical certificates.
@ApiTest
class EmployeePiecesApiTests {

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F'};
    private static final byte[] PDF = "%PDF-1.4 sick note".getBytes(StandardCharsets.US_ASCII);
    private static final int SEEDED_FILES = 22;
    private static final int SEEDED_NOTIFICATIONS = 7;

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    ApiClient arjun;

    @BeforeEach
    void signIn() throws Exception {
        arjun = as("OPR-0018");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("delete from employee_photo");
        jdbc.update("delete from leave_request where length(id) > 7");
        jdbc.update("delete from stored_file where id not in (select file_id from document_file)");
        jdbc.update("delete from change_request where length(id) > 5");
        jdbc.update("delete from notification where id > ?", SEEDED_NOTIFICATIONS);
    }

    private ApiClient as(String employeeId) throws Exception {
        ApiClient client = new ApiClient(port);
        client.signIn(employeeId);
        return client;
    }

    private String applyForSickLeave() throws Exception {
        return JsonPath.read(arjun.post("/api/leave/requests", "{\"type\":\"sick\",\"from\":\"2026-12-06\",\"to\":\"2026-12-08\",\"reason\":\"Dengue\"}").body(), "$.id");
    }

    @Test
    void someoneSeesTheirOwnDocumentsAndDownloadsThem() throws Exception {
        String documents = arjun.get("/api/documents").body();
        assertThat(JsonPath.<List<String>>read(documents, "$[*].name"))
                .containsExactly("Employment contract", "National ID", "Visa copy", "Passport copy", "Educational certificates");
        assertThat(JsonPath.<List<String>>read(documents, "$[?(@.name == 'Visa copy')].expiresOn")).containsExactly("2026-12-20");
        assertThat(JsonPath.<List<String>>read(documents, "$[?(@.name == 'National ID')].status")).containsExactly("missing");

        String contract = JsonPath.<List<String>>read(documents, "$[?(@.type == 'employment-contract')].files[0].id").getFirst();
        HttpResponse<byte[]> file = arjun.getBytes("/api/documents/employment-contract/files/" + contract);

        assertThat(file.statusCode()).isEqualTo(200);
        assertThat(file.headers().firstValue("Content-Type")).hasValue("application/pdf");
        assertThat(file.headers().firstValue("Content-Disposition")).hasValueSatisfying(value -> assertThat(value).startsWith("attachment"));
        assertThat(file.headers().firstValue("Content-Security-Policy")).hasValue("sandbox");
        assertThat(new String(file.body(), 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        assertThat(arjun.getBytes("/api/documents/national-id/files/" + contract).statusCode()).isEqualTo(404);
        assertThat(arjun.getBytes("/api/documents/visa-copy/files/" + contract).statusCode()).isEqualTo(404);
    }

    @Test
    void announcementsComeNewestFirst() throws Exception {
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/announcements").body(), "$[*].id")).first().isEqualTo("AN-12");
    }

    @Test
    void aChangeRequestGoesToHrWithAFieldFromTheList() throws Exception {
        HttpResponse<String> sent = arjun.post("/api/profile/change-requests", "{\"field\":\"Phone number\",\"details\":\" +960 777 8018 \"}");

        assertThat(sent.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<String>read(sent.body(), "$.status")).isEqualTo("open");
        assertThat(JsonPath.<String>read(sent.body(), "$.details")).isEqualTo("+960 777 8018");
        assertThat(arjun.post("/api/profile/change-requests", "{\"field\":\"Salary\",\"details\":\"Double it\"}").statusCode()).isEqualTo(400);
        assertThat(arjun.post("/api/profile/change-requests", "{\"field\":\"Name\",\"details\":\" \"}").statusCode()).isEqualTo(400);
    }

    @Test
    void hrPutsUpAPhotoThatShowsOnTheProfileAndTellsThePerson() throws Exception {
        ApiClient ananya = as("OPR-0002");

        assertThat(ananya.put("/api/hr/employees/OPR-0018/photo", JPEG, "image/jpeg").statusCode()).isEqualTo(204);

        String photoUrl = JsonPath.read(arjun.get("/api/me").body(), "$.photoUrl");
        assertThat(photoUrl).startsWith("/api/employees/OPR-0018/photo?v=");
        HttpResponse<byte[]> photo = as("OPR-0011").getBytes(photoUrl);
        assertThat(photo.body()).isEqualTo(JPEG);
        assertThat(photo.headers().firstValue("Cache-Control")).hasValueSatisfying(value -> assertThat(value).contains("immutable", "private"));
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/notifications").body(), "$[*].text")).first().isEqualTo("HR added a new photo to your ID card.");

        assertThat(ananya.delete("/api/hr/employees/OPR-0018/photo").statusCode()).isEqualTo(204);
        assertThat(arjun.get("/api/me").body()).doesNotContain("photoUrl");
        assertThat(jdbc.queryForObject("select count(*) from stored_file", Integer.class)).isEqualTo(SEEDED_FILES);
    }

    @Test
    void onlyHrCanChangePhotosAndOnlyRealSmallJpegsGetIn() throws Exception {
        assertThat(arjun.put("/api/hr/employees/OPR-0018/photo", JPEG, "image/jpeg").body()).isEqualTo("{\"message\":\"HR only\"}");

        ApiClient ananya = as("OPR-0002");
        assertThat(ananya.put("/api/hr/employees/OPR-0018/photo", "<html>".getBytes(StandardCharsets.US_ASCII), "image/jpeg").statusCode()).isEqualTo(415);
        assertThat(ananya.put("/api/hr/employees/OPR-0018/photo", PDF, "application/pdf").statusCode()).isEqualTo(415);
        byte[] tooBig = new byte[Upload.MEGABYTE + 1];
        System.arraycopy(JPEG, 0, tooBig, 0, JPEG.length);
        HttpResponse<String> large = ananya.put("/api/hr/employees/OPR-0018/photo", tooBig, "image/jpeg");
        assertThat(large.statusCode()).isEqualTo(413);
        assertThat(large.body()).isEqualTo("{\"message\":\"Files can be up to 1 MB.\"}");
    }

    @Test
    void aSickNoteGoesOnSickLeaveAndOnlyItsOwnerCanOpenItHere() throws Exception {
        String id = applyForSickLeave();

        HttpResponse<String> attached = arjun.put("/api/leave/requests/" + id + "/certificate", PDF, "application/pdf");
        assertThat(attached.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<Boolean>read(attached.body(), "$.hasCertificate")).isTrue();

        HttpResponse<byte[]> opened = arjun.getBytes("/api/leave/requests/" + id + "/certificate");
        assertThat(opened.body()).isEqualTo(PDF);
        assertThat(opened.headers().firstValue("Content-Disposition")).hasValueSatisfying(value -> assertThat(value).startsWith("inline"));
        assertThat(opened.headers().firstValue("Cache-Control")).hasValueSatisfying(value -> assertThat(value).contains("no-store"));
        assertThat(as("OPR-0004").getBytes("/api/leave/requests/" + id + "/certificate").statusCode()).isEqualTo(404);
    }

    @Test
    void aNewCertificateReplacesTheOldOneAndOnlySickLeaveTakesOne() throws Exception {
        String id = applyForSickLeave();
        arjun.put("/api/leave/requests/" + id + "/certificate", PDF, "application/pdf");
        arjun.put("/api/leave/requests/" + id + "/certificate", JPEG, "image/jpeg");

        assertThat(jdbc.queryForObject("select count(*) from stored_file", Integer.class)).isEqualTo(SEEDED_FILES + 1);
        String annual = JsonPath.read(arjun.post("/api/leave/requests", "{\"type\":\"annual\",\"from\":\"2026-12-13\",\"to\":\"2026-12-13\",\"reason\":\"x\"}").body(), "$.id");
        assertThat(arjun.put("/api/leave/requests/" + annual + "/certificate", PDF, "application/pdf").statusCode()).isEqualTo(409);
    }
}
