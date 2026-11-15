package mv.opro.hrms.attendance;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

// Where "at the office" and "at a resort" can be punched from, and how sure the phone has to be about where it is.
@ConfigurationProperties("opro.punch")
record PunchSettings(List<Office> offices, List<Office> resorts, int maxAccuracyMetres) {

    record Office(String name, double latitude, double longitude, int radiusMetres) {}
}
