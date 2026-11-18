package mv.opro.hrms.record;

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

// Arjun (OPR-0018) has verified bank details, insurance, one qualification and one past job. Priya (OPR-0015) has bank
// details waiting for HR. Ananya (OPR-0002) is HR. Today is 12 November 2026.
@ApiTest
class RecordApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;
    private static final String BANK = "{\"bankName\":\"Bank of Maldives\",\"accountName\":\"Arjun Reddy\",\"accountNumber\":\"7730 0001 99999\",\"currency\":\"USD\"}";

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
        jdbc.update("update bank_account set account_number = '7730000123456', currency = 'MVR', status = 'verified', submitted_on = '2026-01-10', "
                + "decided_by = 'OPR-0002', decided_on = '2026-01-11', decision_note = null where employee_id = 'OPR-0018'");
        jdbc.update("update bank_account set status = 'pending', decided_by = null, decided_on = null, decision_note = null where employee_id = 'OPR-0015'");
        jdbc.update("delete from bank_account where employee_id not in ('OPR-0018', 'OPR-0015')");
        jdbc.update("update medical_insurance set provider = 'Allied Insurance', policy_number = 'AIM-602388', expires_on = '2027-04-30' where employee_id = 'OPR-0018'");
        jdbc.update("delete from medical_insurance where employee_id not in ('OPR-0015', 'OPR-0018', 'OPR-0021', 'OPR-0027')");
        jdbc.update("delete from education where length(id) > 4");
        jdbc.update("delete from work_experience where length(id) > 4");
        jdbc.update("delete from quota_approval where length(id) > 4");
        jdbc.update("update quota_approval set slots = 2 where id = 'QA-1'");
        jdbc.update("delete from notification where id > ?", SEEDED_NOTIFICATIONS);
    }

    private ApiClient as(String employeeId) throws Exception {
        ApiClient client = new ApiClient(port);
        client.signIn(employeeId);
        return client;
    }

    @Test
    void someoneSeesTheirRecordWithOnlyTheLastFourOfTheirAccount() throws Exception {
        String mine = arjun.get("/api/profile/record").body();

        assertThat(JsonPath.<String>read(mine, "$.insurance.provider")).isEqualTo("Allied Insurance");
        assertThat(JsonPath.<String>read(mine, "$.bankAccount.accountLast4")).isEqualTo("3456");
        assertThat(JsonPath.<List<Object>>read(mine, "$.bankAccount[?(@.accountNumber)]")).isEmpty();
        assertThat(JsonPath.<List<String>>read(mine, "$.education[*].qualification")).containsExactly("BTech, Civil Engineering");
        assertThat(JsonPath.<List<String>>read(mine, "$.experience[*].employer")).containsExactly("L&T Construction");
        assertThat(JsonPath.<String>read(ananya.get("/api/hr/employees/OPR-0018/record").body(), "$.bankAccount.accountNumber")).isEqualTo("7730000123456");
        assertThat(as("OPR-0004").get("/api/hr/employees/OPR-0018/record").statusCode()).isEqualTo(403);
    }

    @Test
    void newBankDetailsWaitForHrWhoVerifiesOrSendsThemBack() throws Exception {
        String sent = arjun.put("/api/profile/bank-account", BANK).body();
        assertThat(JsonPath.<String>read(sent, "$.status")).isEqualTo("pending");
        assertThat(JsonPath.<List<String>>read(ananya.get("/api/hr/bank-accounts").body(), "$[*].employeeName")).contains("Arjun Reddy", "Priya Nair");
        assertThat(JsonPath.<List<String>>read(ananya.get("/api/hr/bank-accounts").body(), "$[?(@.employeeId == 'OPR-0018')].accountNumber"))
                .containsExactly("7730000199999");

        String decision = "/api/hr/employees/OPR-0018/bank-account/decision";
        assertThat(ananya.post(decision, "{\"decision\":\"rejected\"}").statusCode()).isEqualTo(400);
        ananya.post(decision, "{\"decision\":\"rejected\",\"note\":\"The name doesn't match the bank letter\"}");
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/notifications").body(), "$[*].text"))
                .contains("HR sent back your bank details: The name doesn't match the bank letter. Enter them again from your profile.");

        arjun.put("/api/profile/bank-account", BANK);
        assertThat(JsonPath.<String>read(ananya.post(decision, "{\"decision\":\"verified\"}").body(), "$.status")).isEqualTo("verified");
        assertThat(ananya.post(decision, "{\"decision\":\"verified\"}").statusCode()).isEqualTo(409);
        assertThat(arjun.put("/api/profile/bank-account", BANK.replace("7730 0001 99999", "12ab")).statusCode()).isEqualTo(400);
    }

    @Test
    void hrKeepsInsuranceEducationAndExperienceButNeverTheirOwn() throws Exception {
        ananya.put("/api/hr/employees/OPR-0018/insurance", "{\"provider\":\"Ascension\",\"policyNumber\":\"AS-1\",\"expiresOn\":\"2027-12-31\"}");
        String education = ananya.post("/api/hr/employees/OPR-0018/education",
                "{\"qualification\":\"MBA\",\"institution\":\"ISB\",\"completedYear\":2024}").body();
        ananya.post("/api/hr/employees/OPR-0018/experience", "{\"employer\":\"Tata Projects\",\"role\":\"Intern\",\"from\":\"2015-05-01\",\"to\":\"2015-07-31\"}");

        String record = arjun.get("/api/profile/record").body();
        assertThat(JsonPath.<String>read(record, "$.insurance.provider")).isEqualTo("Ascension");
        assertThat(JsonPath.<List<String>>read(record, "$.education[*].qualification")).containsExactly("MBA", "BTech, Civil Engineering");
        assertThat(JsonPath.<List<String>>read(record, "$.experience[*].employer")).containsExactly("L&T Construction", "Tata Projects");
        assertThat(JsonPath.<List<String>>read(arjun.get("/api/notifications").body(), "$[*].text"))
                .contains("HR updated your medical insurance. It runs until 31 December 2027.");

        assertThat(ananya.delete("/api/hr/employees/OPR-0018/education/" + JsonPath.read(education, "$.id")).statusCode()).isEqualTo(204);
        assertThat(ananya.post("/api/hr/employees/OPR-0018/education", "{\"qualification\":\"PhD\",\"institution\":\"IIT\",\"completedYear\":2030}")
                .statusCode()).isEqualTo(400);
        assertThat(ananya.put("/api/hr/employees/OPR-0002/insurance", "{\"provider\":\"A\",\"policyNumber\":\"B\",\"expiresOn\":\"2027-01-01\"}")
                .statusCode()).isEqualTo(403);
    }

    @Test
    void theQuotaCountsActiveExpatriatesByJobCategory() throws Exception {
        String quotas = ananya.get("/api/hr/quotas").body();

        assertThat(JsonPath.<List<Integer>>read(quotas, "$[?(@.jobCategory == 'Engineering')].used")).containsExactly(1);
        assertThat(JsonPath.<List<Integer>>read(quotas, "$[?(@.jobCategory == 'Administration')].used")).containsExactly(2);
        assertThat(JsonPath.<List<Integer>>read(quotas, "$[?(@.jobCategory == 'Management')].used")).containsExactly(3);

        String added = ananya.post("/api/hr/quotas",
                "{\"jobCategory\":\"logistics \",\"slots\":4,\"approvalNumber\":\"QT-9\",\"approvedOn\":\"2026-11-01\",\"expiresOn\":\"2027-11-01\"}").body();
        assertThat(JsonPath.<Integer>read(added, "$.used")).isEqualTo(1);
        assertThat(ananya.post("/api/hr/quotas",
                "{\"jobCategory\":\"X\",\"slots\":1,\"approvalNumber\":\"QT-9\",\"approvedOn\":\"2026-11-01\",\"expiresOn\":\"2026-10-01\"}").statusCode()).isEqualTo(400);
        assertThat(arjun.get("/api/hr/quotas").statusCode()).isEqualTo(403);
    }

    @Test
    void theRecordAndVisaCarryTheNewDetails() throws Exception {
        String visa = "{\"workPermitNumber\":\"WP-1\",\"visaNumber\":\"V-1\",\"passportLast4\":\"7730\",\"passportExpiry\":\"2028-02-11\","
                + "\"visaIssuedOn\":\"2024-12-21\",\"visaExpiry\":\"2026-12-20\",\"employmentApprovalNumber\":\"EA-1\"}";
        HttpResponse<String> halfApproval = ananya.put("/api/hr/employees/OPR-0018/visa", visa);
        assertThat(halfApproval.body()).isEqualTo("{\"message\":\"Give the employment approval's number and expiry together.\"}");

        String me = arjun.get("/api/me").body();
        assertThat(JsonPath.<String>read(me, "$.gender")).isEqualTo("male");
        assertThat(JsonPath.<String>read(me, "$.employmentType")).isEqualTo("Contract");
        assertThat(JsonPath.<String>read(me, "$.contractEndsOn")).isEqualTo("2027-01-15");
        assertThat(JsonPath.<String>read(me, "$.visa.employmentApprovalNumber")).isEqualTo("EA-2023-204117");
    }
}
