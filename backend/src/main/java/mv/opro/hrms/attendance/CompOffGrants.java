package mv.opro.hrms.attendance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Component;

// Approved compensatory off, read by leave balances. Kept apart from CompOffs, which itself calls into leave.
@Component
public class CompOffGrants {

    public record Grant(LocalDate workedOn, BigDecimal days) {}

    private final CompOffClaimRepository claims;

    CompOffGrants(CompOffClaimRepository claims) {
        this.claims = claims;
    }

    public List<Grant> of(String employeeId) {
        return claims.findByEmployeeIdAndStatus(employeeId, "approved").stream().map(claim -> new Grant(claim.getWorkDate(), claim.getDays())).toList();
    }
}
