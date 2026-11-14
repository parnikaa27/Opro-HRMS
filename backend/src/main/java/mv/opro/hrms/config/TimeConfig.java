package mv.opro.hrms.config;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// Opro runs on Maldives time. Everything that asks "what day is it" goes through this clock.
// opro.fixed-time pins it (dev and tests), the way the mock's MOCK_NOW does, so a weekend can still show a working day.
@Configuration
class TimeConfig {

    @Bean
    Clock clock(@Value("${opro.time-zone}") String timeZone, @Value("${opro.fixed-time:}") String fixedTime) {
        ZoneId zone = ZoneId.of(timeZone);
        return fixedTime.isBlank() ? Clock.system(zone) : Clock.fixed(OffsetDateTime.parse(fixedTime).toInstant(), zone);
    }
}
