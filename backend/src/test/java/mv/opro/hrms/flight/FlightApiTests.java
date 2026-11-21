package mv.opro.hrms.flight;

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

// Arjun (OPR-0018) gets $1,200 for 2026 and has $400 approved. One US dollar is 15.42 MVR and 88 INR. Ananya (OPR-0002) is HR.
@ApiTest
class FlightApiTests {

    private static final int SEEDED_NOTIFICATIONS = 7;
    private static final int SEEDED_FILES = 31;
    private static final byte[] PDF = "%PDF-1.4 ticket".getBytes(StandardCharsets.US_ASCII);

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
        jdbc.update("delete from flight_claim where id not in ('FC-1', 'FC-2')");
        jdbc.update("delete from stored_file where id not in (select file_id from document_file)");
        jdbc.update("update flight_allowance set amount_usd = 1200 where employee_id = 'OPR-0018'");
        jdbc.update("delete from flight_allowance where allowance_year <> 2026");
        jdbc.update("update exchange_rate set per_usd = 15.42 where currency = 'MVR'");
        jdbc.update("delete from notification where id > ?", SEEDED_NOTIFICATIONS);
    }

    private ApiClient as(String employeeId) throws Exception {
        ApiClient client = new ApiClient(port);
        client.signIn(employeeId);
        return client;
    }

    private HttpResponse<String> claim(String amount, String currency) throws Exception {
        return arjun.post("/api/flights/claims",
                "{\"flightDate\":\"2026-12-18\",\"route\":\"Malé to Colombo and back\",\"amount\":" + amount + ",\"currency\":\"" + currency + "\"}");
    }

    private double field(String json, String path) {
        return JsonPath.<Number>read(json, path).doubleValue();
    }

    @Test
    void showsTheYearUsedAndTheRates() throws Exception {
        String year = arjun.get("/api/flights").body();

        assertThat(field(year, "$.allowanceUsd")).isEqualTo(1200);
        assertThat(field(year, "$.usedUsd")).isEqualTo(400);
        assertThat(field(year, "$.ratesPerUsd.MVR")).isEqualTo(15.42);
        assertThat(JsonPath.<List<String>>read(year, "$.claims[*].route")).containsExactly("Malé to Colombo and back");
    }

    @Test
    void aClaimInRufiyaaIsCountedInDollars() throws Exception {
        String claim = claim("1542", "MVR").body();

        assertThat(field(claim, "$.amountUsd")).isEqualTo(100);
        assertThat(field(arjun.get("/api/flights").body(), "$.usedUsd")).isEqualTo(500);
    }

    @Test
    void neverMoreThanIsLeft() throws Exception {
        claim("700", "USD");

        assertThat(claim("101", "USD").body()).isEqualTo("{\"message\":\"That's $101.00, more than the $100.00 you have left for 2026.\"}");
        assertThat(as("OPR-0011").post("/api/flights/claims", "{\"flightDate\":\"2026-12-18\",\"route\":\"Home\",\"amount\":10,\"currency\":\"USD\"}").body())
                .isEqualTo("{\"message\":\"You don't have a flight allowance for 2026. Ask HR about it.\"}");
    }

    @Test
    void aYearHrHasntSetCarriesTheLastAllowance() throws Exception {
        // Arjun has $1,200 for 2026 and nothing set for 2027 yet.
        HttpResponse<String> nextYear = arjun.post("/api/flights/claims", "{\"flightDate\":\"2027-02-10\",\"route\":\"Home\",\"amount\":1200,\"currency\":\"USD\"}");

        assertThat(nextYear.statusCode()).isEqualTo(200);
        assertThat(arjun.post("/api/flights/claims", "{\"flightDate\":\"2027-03-10\",\"route\":\"Home\",\"amount\":1,\"currency\":\"USD\"}").body())
                .isEqualTo("{\"message\":\"That's $1.00, more than the $0.00 you have left for 2027.\"}");
    }

    @Test
    void theReceiptIsForThemAndHrOnly() throws Exception {
        String id = JsonPath.read(claim("300", "USD").body(), "$.id");

        assertThat(JsonPath.<Boolean>read(arjun.put("/api/flights/claims/" + id + "/receipt", PDF, "application/pdf").body(), "$.hasReceipt")).isTrue();
        assertThat(arjun.getBytes("/api/flights/claims/" + id + "/receipt").statusCode()).isEqualTo(200);
        assertThat(ananya.getBytes("/api/hr/flight-claims/" + id + "/receipt").statusCode()).isEqualTo(200);
        assertThat(as("OPR-0004").getBytes("/api/flights/claims/" + id + "/receipt").statusCode()).isEqualTo(404);
        assertThat(jdbc.queryForObject("select count(*) from stored_file", Integer.class)).isEqualTo(SEEDED_FILES + 1);
    }

    @Test
    void aClaimIsApprovedAsItIsMadeWithNobodyToDecide() throws Exception {
        String claim = claim("300", "USD").body();

        assertThat(JsonPath.<String>read(claim, "$.status")).isEqualTo("approved");
        assertThat(field(arjun.get("/api/flights").body(), "$.usedUsd")).isEqualTo(700);
        String id = JsonPath.read(claim, "$.id");
        assertThat(ananya.post("/api/hr/flight-claims/" + id + "/decision", "{\"decision\":\"rejected\",\"note\":\"No\"}").statusCode()).isEqualTo(404);
    }

    @Test
    void cancellingAClaimGivesTheMoneyBackOnce() throws Exception {
        String id = JsonPath.read(claim("300", "USD").body(), "$.id");

        assertThat(JsonPath.<String>read(arjun.post("/api/flights/claims/" + id + "/cancel", "{}").body(), "$.status")).isEqualTo("cancelled");
        assertThat(field(arjun.get("/api/flights").body(), "$.usedUsd")).isEqualTo(400);
        assertThat(arjun.post("/api/flights/claims/" + id + "/cancel", "{}").statusCode()).isEqualTo(409);
    }

    @Test
    void hrSetsTheAllowanceButNeverBelowWhatIsClaimedOrTheirOwn() throws Exception {
        ananya.put("/api/hr/employees/OPR-0018/flight-allowance", "{\"year\":2026,\"amountUsd\":1500}");
        assertThat(field(arjun.get("/api/flights").body(), "$.allowanceUsd")).isEqualTo(1500);

        assertThat(ananya.put("/api/hr/employees/OPR-0018/flight-allowance", "{\"year\":2026,\"amountUsd\":300}").body())
                .isEqualTo("{\"message\":\"They've already claimed $400.00 for 2026, so it can't go below that.\"}");
        assertThat(ananya.put("/api/hr/employees/OPR-0002/flight-allowance", "{\"year\":2026,\"amountUsd\":5000}").statusCode()).isEqualTo(403);
    }

    @Test
    void newRatesApplyToNewClaims() throws Exception {
        String rates = ananya.put("/api/hr/exchange-rates", "{\"mvr\":15.0,\"inr\":90}").body();
        assertThat(field(rates, "$.MVR")).isEqualTo(15.0);

        assertThat(field(claim("1500", "MVR").body(), "$.amountUsd")).isEqualTo(100);
        assertThat(as("OPR-0004").put("/api/hr/exchange-rates", "{\"mvr\":1,\"inr\":1}").statusCode()).isEqualTo(403);
    }
}
