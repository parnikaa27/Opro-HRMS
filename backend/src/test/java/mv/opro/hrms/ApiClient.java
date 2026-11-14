package mv.opro.hrms;

import java.io.IOException;
import java.net.CookieManager;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

// A browser stand in: keeps cookies, and echoes the XSRF-TOKEN cookie in the header the way Angular does.
public final class ApiClient {

    private final CookieManager cookies = new CookieManager();
    private final HttpClient http = HttpClient.newBuilder().cookieHandler(cookies).build();
    private final String base;

    public ApiClient(int port) {
        this.base = "http://localhost:" + port;
    }

    public HttpResponse<String> get(String path) throws IOException, InterruptedException {
        return http.send(HttpRequest.newBuilder(URI.create(base + path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    public HttpResponse<String> post(String path, String json) throws IOException, InterruptedException {
        return send(path, json, true);
    }

    public HttpResponse<String> postWithoutXsrf(String path, String json) throws IOException, InterruptedException {
        return send(path, json, false);
    }

    public HttpResponse<byte[]> getBytes(String path) throws IOException, InterruptedException {
        return http.send(HttpRequest.newBuilder(URI.create(base + path)).GET().build(), HttpResponse.BodyHandlers.ofByteArray());
    }

    // A raw file upload, the way the frontend sends photos and certificates.
    public HttpResponse<String> put(String path, byte[] body, String contentType) throws IOException, InterruptedException {
        return http.send(withXsrf(HttpRequest.newBuilder(URI.create(base + path)).header("Content-Type", contentType)
                .PUT(HttpRequest.BodyPublishers.ofByteArray(body))).build(), HttpResponse.BodyHandlers.ofString());
    }

    public HttpResponse<String> delete(String path) throws IOException, InterruptedException {
        return http.send(withXsrf(HttpRequest.newBuilder(URI.create(base + path)).DELETE()).build(), HttpResponse.BodyHandlers.ofString());
    }

    public HttpResponse<String> signIn(String employeeId) throws IOException, InterruptedException {
        get("/api/session/users");
        return post("/api/session/login", "{\"employeeId\":\"" + employeeId + "\"}");
    }

    private HttpResponse<String> send(String path, String json, boolean withXsrf) throws IOException, InterruptedException {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(base + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json));
        return http.send((withXsrf ? withXsrf(request) : request).build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpRequest.Builder withXsrf(HttpRequest.Builder request) {
        cookies.getCookieStore().getCookies().stream()
                .filter(cookie -> cookie.getName().equals("XSRF-TOKEN"))
                .map(HttpCookie::getValue)
                .findFirst()
                .ifPresent(token -> request.header("X-XSRF-TOKEN", token));
        return request;
    }
}
