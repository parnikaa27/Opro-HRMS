package mv.opro.hrms.exit;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import java.io.Serializable;
import java.time.LocalDate;

// One item ticked off on someone's way out: returned, or never given to them.
@Entity
@IdClass(ExitReturn.Key.class)
public class ExitReturn {

    record Key(String resignationId, String itemId) implements Serializable {}

    @Id
    private String resignationId;

    @Id
    private String itemId;

    private String outcome;
    private String tickedBy;
    private LocalDate tickedOn;

    protected ExitReturn() {}

    ExitReturn(String resignationId, String itemId, String outcome, String tickedBy, LocalDate tickedOn) {
        this.resignationId = resignationId;
        this.itemId = itemId;
        this.outcome = outcome;
        this.tickedBy = tickedBy;
        this.tickedOn = tickedOn;
    }

    public String getItemId() {
        return itemId;
    }

    public String getOutcome() {
        return outcome;
    }

    public LocalDate getTickedOn() {
        return tickedOn;
    }
}
