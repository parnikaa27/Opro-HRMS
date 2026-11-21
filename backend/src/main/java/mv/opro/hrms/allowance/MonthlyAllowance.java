package mv.opro.hrms.allowance;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.math.BigDecimal;
import java.time.LocalDate;

// What someone gets every month of one kind, from a month on, until it ends.
@Entity
public class MonthlyAllowance {

    @Id
    private String id;

    private String employeeId;
    private String typeCode;
    private BigDecimal amount;
    private String currency;
    private LocalDate startsOn;
    private LocalDate endsOn;
    private String note;
    private String setBy;
    private LocalDate setOn;

    protected MonthlyAllowance() {}

    MonthlyAllowance(String id, String employeeId, String typeCode, BigDecimal amount, String currency, LocalDate startsOn, String note, String setBy,
            LocalDate setOn) {
        this.id = id;
        this.employeeId = employeeId;
        this.typeCode = typeCode;
        this.amount = amount;
        this.currency = currency;
        this.startsOn = startsOn;
        this.note = note;
        this.setBy = setBy;
        this.setOn = setOn;
    }

    void end(LocalDate on) {
        endsOn = on;
    }

    public String getId() {
        return id;
    }

    public String getTypeCode() {
        return typeCode;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getCurrency() {
        return currency;
    }

    public LocalDate getStartsOn() {
        return startsOn;
    }

    public LocalDate getEndsOn() {
        return endsOn;
    }

    public String getNote() {
        return note;
    }
}
