package mv.opro.hrms.leave;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.math.BigDecimal;
import java.time.LocalDate;

// One manual change to a balance, kept for good: who, when and why.
@Entity
public class BalanceAdjustment {

    @Id
    private String id;

    private String employeeId;
    private String type;
    private int leaveYear;
    private BigDecimal days;
    private String reason;
    private String madeBy;
    private LocalDate madeOn;

    protected BalanceAdjustment() {}

    BalanceAdjustment(String id, String employeeId, String type, int leaveYear, BigDecimal days, String reason, String madeBy, LocalDate madeOn) {
        this.id = id;
        this.employeeId = employeeId;
        this.type = type;
        this.leaveYear = leaveYear;
        this.days = days;
        this.reason = reason;
        this.madeBy = madeBy;
        this.madeOn = madeOn;
    }

    public String getId() {
        return id;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public String getType() {
        return type;
    }

    public BigDecimal getDays() {
        return days;
    }

    public String getReason() {
        return reason;
    }

    public String getMadeBy() {
        return madeBy;
    }

    public LocalDate getMadeOn() {
        return madeOn;
    }
}
