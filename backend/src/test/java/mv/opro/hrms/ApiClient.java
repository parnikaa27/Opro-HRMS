package mv.opro.hrms;

import java.io.IOException;
import java.net.CookieManager;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

// A browser stand in: keeps cookies, and echoes the XSRF-TOKEN cookie in the header the way Angular does.
final class ApiClient {

    private final CookieManager cookies = new CookieManager();
    private final HttpClient http = HttpClient.newBuilder().cookieHandler(cookies).build();
    private final String base;

    ApiClient(int port) {
        this.base = "http://localhost:" + port;
    }

    HttpResponse<String> get(String path) throws IOException, InterruptedException {
        return http.send(HttpRequest.newBuilder(URI.create(base + path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    HttpResponse<String> post(String path, String json) throws IOException, InterruptedException {
        return send(path, json, true);
    }

    HttpResponse<String> postWithoutXsrf(String path, String json) throws IOException, InterruptedException {
        return send(path, json, false);
    }

    HttpResponse<String> signIn(String employeeId) throws IOException, InterruptedException {
        get("/api/session/users");
        return post("/api/session/login", "{\"employeeId\":\"" + employeeId + "\"}");
    }

    private HttpResponse<String> send(String path, String json, boolean withXsrf) throws IOException, InterruptedException {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(base + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json));
        if (withXsrf) {
            cookies.getCookieStore().getCookies().stream()
                    .filter(cookie -> cookie.getName().equals("XSRF-TOKEN"))
                    .map(HttpCookie::getValue)
                    .findFirst()
                    .ifPresent(token -> request.header("X-XSRF-TOKEN", token));
        }
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
