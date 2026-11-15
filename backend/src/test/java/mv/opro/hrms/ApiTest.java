package mv.opro.hrms;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

// Every API test runs the real server on the dev seed data, on a pinned Thursday (12 November 2026, 10:30 in Malé),
// without generated punches or scheduled reminders so each test controls its own. Sharing this keeps one Spring context and one database.
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Import(TestcontainersConfiguration.class)
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"opro.fixed-time=2026-11-12T10:30:00+05:00", "opro.dev.generate-punches=false", "opro.visa-reminders.scheduled=false"})
@ActiveProfiles("dev")
public @interface ApiTest {}
