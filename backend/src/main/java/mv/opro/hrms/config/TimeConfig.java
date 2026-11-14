package mv.opro.hrms.config;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// Opro runs on Maldives time. Everything that asks "what day is it" goes through this clock, so tests can pin it.
@Configuration
class TimeConfig {

    @Bean
    Clock clock(@Value("${opro.time-zone}") String timeZone) {
        return Clock.system(ZoneId.of(timeZone));
    }
}
