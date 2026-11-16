package mv.opro.hrms.security;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

// The session lives in an httpOnly cookie. Every change needs the XSRF-TOKEN cookie echoed back in the
// X-XSRF-TOKEN header, which Angular does by itself. Nothing redirects: the API only ever answers in JSON.
@Configuration
class SecurityConfig {

    // The API docs are switched off outside the dev profile, so these paths only answer in development.
    private static final String[] PUBLIC = {"/api/session/users", "/api/session/login", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html"};

    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        CookieCsrfTokenRepository xsrf = CookieCsrfTokenRepository.withHttpOnlyFalse();
        xsrf.setCookieCustomizer(cookie -> cookie.sameSite("Strict").path("/"));

        return http
                .csrf(csrf -> csrf.spa().csrfTokenRepository(xsrf))
                .authorizeHttpRequests(requests -> requests.requestMatchers(PUBLIC).permitAll().anyRequest().authenticated())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, error) -> json(response, HttpStatus.UNAUTHORIZED, "Please sign in"))
                        .accessDeniedHandler((request, response, error) -> json(response, HttpStatus.FORBIDDEN, "You can't do that")))
                .logout(logout -> logout
                        .logoutUrl("/api/session/logout")
                        .deleteCookies("opro_session")
                        .logoutSuccessHandler((request, response, authentication) -> response.setStatus(HttpStatus.NO_CONTENT.value())))
                // An API never redirects back after sign in, so a signed out request has no reason to start a session.
                .requestCache(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .build();
    }

    private static void json(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8);
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
