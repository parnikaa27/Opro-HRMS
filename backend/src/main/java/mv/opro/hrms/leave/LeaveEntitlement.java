package mv.opro.hrms.leave;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import java.io.Serializable;
import java.math.BigDecimal;

// What someone gets of one leave type in one leave year.
@Entity
@IdClass(LeaveEntitlement.Key.class)
public class LeaveEntitlement {

    public record Key(String employeeId, String type, int leaveYear) implements Serializable {}

    @Id
    private String employeeId;

    @Id
    private String type;

    @Id
    private int leaveYear;

    private BigDecimal entitled;

    // Leave used before Opro HRMS existed. Everything since comes from requests.
    private BigDecimal takenBefore;

    protected LeaveEntitlement() {}

    // A new year starts with the policy's default and nothing taken. Carry forward is none until HR confirms otherwise.
    static LeaveEntitlement fresh(String employeeId, String type, int leaveYear, BigDecimal entitled) {
        LeaveEntitlement entitlement = new LeaveEntitlement();
        entitlement.employeeId = employeeId;
        entitlement.type = type;
        entitlement.leaveYear = leaveYear;
        entitlement.entitled = entitled;
        entitlement.takenBefore = BigDecimal.ZERO;
        return entitlement;
    }

    void adjust(BigDecimal days) {
        entitled = entitled.add(days);
    }

    public String getType() {
        return type;
    }

    public BigDecimal getEntitled() {
        return entitled;
    }

    public BigDecimal getTakenBefore() {
        return takenBefore;
    }
}
