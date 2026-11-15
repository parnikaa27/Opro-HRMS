package mv.opro.hrms;

import org.springframework.boot.SpringApplication;

// Spring on a throwaway PostgreSQL, for the e2e tests: ./mvnw spring-boot:test-run -Dspring-boot.run.profiles=dev
// Every run starts from the seed data and never touches the development database.
public class TestHrmsBackendApplication {

    public static void main(String[] args) {
        SpringApplication.from(HrmsBackendApplication::main).with(TestcontainersConfiguration.class).run(args);
    }
}
