package mv.opro.hrms.leave;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
public class LeaveType {

    // Earned by working a Friday or a public holiday. The policy never gives it.
    public static final String COMP_OFF = "comp-off";

    // What HR sets from Policies.
    public record Rules(String name, boolean allowsHalfDay, boolean isUnlimited, BigDecimal defaultEntitlement, Integer documentRequiredAfterDays,
            boolean isForEveryone, boolean carriesForward, BigDecimal carryForwardCap) {}

    @Id
    private String code;

    private String name;
    private boolean allowsHalfDay;
    private boolean isUnlimited;
    private BigDecimal defaultEntitlement;
    private Integer documentRequiredAfterDays;
    private int sortOrder;
    private boolean isForEveryone;
    private boolean carriesForward;
    private BigDecimal carryForwardCap;
    private LocalDate retiredOn;

    protected LeaveType() {}

    static LeaveType create(String code, int sortOrder, Rules rules) {
        LeaveType type = new LeaveType();
        type.code = code;
        type.sortOrder = sortOrder;
        type.isUnlimited = rules.isUnlimited();
        type.update(rules);
        return type;
    }

    // A new entitlement applies from the next leave year. This year's balances stay as they are.
    void update(Rules rules) {
        this.name = rules.name();
        this.allowsHalfDay = rules.allowsHalfDay();
        this.defaultEntitlement = isUnlimited ? null : rules.defaultEntitlement();
        this.documentRequiredAfterDays = rules.documentRequiredAfterDays();
        this.isForEveryone = rules.isForEveryone();
        this.carriesForward = !isUnlimited && rules.carriesForward();
        this.carryForwardCap = carriesForward ? rules.carryForwardCap() : null;
    }

    void retire(LocalDate on) {
        retiredOn = on;
    }

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

    public int getSortOrder() {
        return sortOrder;
    }

    public boolean isForEveryone() {
        return isForEveryone;
    }

    public boolean carriesForward() {
        return carriesForward;
    }

    public BigDecimal getCarryForwardCap() {
        return carryForwardCap;
    }

    public LocalDate getRetiredOn() {
        return retiredOn;
    }

    public boolean isRetired() {
        return retiredOn != null;
    }
}
