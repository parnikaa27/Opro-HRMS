package mv.opro.hrms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

// No username and password sign in exists, so Spring's generated default user is switched off.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class HrmsBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(HrmsBackendApplication.class, args);
    }
}
