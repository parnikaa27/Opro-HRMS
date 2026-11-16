package mv.opro.hrms.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// The front page of the API docs (development only). Each controller's tag explains its part.
@Configuration
class OpenApiConfig {

    private static final String GUIDE = """
            The API behind the Opro HRMS portal. The browser calls it on the same origin, under `/api`.

            **Signing in.** A session lives in the `opro_session` cookie: httpOnly, Secure and SameSite=Strict. In development, \
            `POST /api/session/login` with `{"employeeId": "OPR-0018"}` signs in as anyone. Production sign in is still to come.

            **Changes need the XSRF token.** Every POST, PUT and DELETE must send the `XSRF-TOKEN` cookie's value back in an \
            `X-XSRF-TOKEN` header, or it's refused with 403. Angular does this by itself.

            **Errors** always look like `{"message": "..."}`, written for the person reading it: 400 for something to fix, \
            401 when signed out, 403 for a role that can't, 404 when it isn't there or isn't theirs, 409 when it clashes with \
            what's already there.

            **Uploads** are the raw request body with its own `Content-Type`: photos are JPEG up to 1 MB; certificates, receipts \
            and documents are PDF, JPG or PNG up to 5 MB. The first bytes must match the type.

            **Roles** are worked out on every request. Everyone is an employee. An HOD (`MANAGER`) is anyone with active direct \
            reports, HR and super admins are set on the record. Paths under `/api/hr` are HR only, `/api/team` is for HODs and \
            `/api/company` for super admins. Nobody acts on their own record there.

            **Dates** are `YYYY-MM-DD` in Maldives time, times are `HH:mm`, and fields with no value are left out.
            """;

    @Bean
    OpenAPI openApi() {
        return new OpenAPI().info(new Info().title("Opro HRMS API").version("v1").description(GUIDE));
    }
}
