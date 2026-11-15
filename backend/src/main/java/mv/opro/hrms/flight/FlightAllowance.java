package mv.opro.hrms.flight;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

// What one person can claim for flights in one year, in USD.
@Entity
@IdClass(FlightAllowance.Key.class)
class FlightAllowance {

    record Key(String employeeId, int allowanceYear) implements Serializable {}

    @Id
    private String employeeId;

    @Id
    @Column(name = "allowance_year")
    private int allowanceYear;

    private BigDecimal amountUsd;
    private String setBy;
    private LocalDate setOn;

    protected FlightAllowance() {}

    FlightAllowance(String employeeId, int allowanceYear) {
        this.employeeId = employeeId;
        this.allowanceYear = allowanceYear;
    }

    void set(BigDecimal amountUsd, String by, LocalDate on) {
        this.amountUsd = amountUsd;
        this.setBy = by;
        this.setOn = on;
    }

    BigDecimal getAmountUsd() {
        return amountUsd;
    }
}
