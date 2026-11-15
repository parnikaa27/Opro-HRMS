package mv.opro.hrms.flight;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.math.BigDecimal;
import java.time.LocalDate;

// How many of a currency one US dollar buys.
@Entity
class ExchangeRate {

    @Id
    private String currency;

    private BigDecimal perUsd;
    private String setBy;
    private LocalDate setOn;

    protected ExchangeRate() {}

    void change(BigDecimal perUsd, String by, LocalDate on) {
        this.perUsd = perUsd;
        this.setBy = by;
        this.setOn = on;
    }

    String getCurrency() {
        return currency;
    }

    BigDecimal getPerUsd() {
        return perUsd;
    }
}
