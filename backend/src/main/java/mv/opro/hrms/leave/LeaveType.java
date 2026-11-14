package mv.opro.hrms.leave;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.math.BigDecimal;

@Entity
public class LeaveType {

    @Id
    private String code;

    private String name;
    private boolean allowsHalfDay;
    private boolean isUnlimited;
    private BigDecimal defaultEntitlement;
    private Integer documentRequiredAfterDays;
    private int sortOrder;

    protected LeaveType() {}

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public boolean allowsHalfDay() {
        return allowsHalfDay;
    }

    public boolean isUnlimited() {
        return isUnlimited;
    }

    public BigDecimal getDefaultEntitlement() {
        return defaultEntitlement;
    }

    public Integer getDocumentRequiredAfterDays() {
        return documentRequiredAfterDays;
    }
}
