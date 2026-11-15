package mv.opro.hrms.flight;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

// A flight someone paid for and claims back from their allowance.
@Entity
public class FlightClaim {

    @Id
    private String id;

    private String employeeId;
    private LocalDate flightDate;
    private String route;
    private BigDecimal amount;
    private String currency;
    private BigDecimal amountUsd;
    private UUID receiptFileId;
    private String status;
    private LocalDate raisedOn;
    private String decidedBy;
    private LocalDate decidedOn;
    private String decisionNote;

    protected FlightClaim() {}

    FlightClaim(String id, String employeeId, LocalDate flightDate, String route, BigDecimal amount, String currency, BigDecimal amountUsd,
            LocalDate raisedOn) {
        this.id = id;
        this.employeeId = employeeId;
        this.flightDate = flightDate;
        this.route = route;
        this.amount = amount;
        this.currency = currency;
        this.amountUsd = amountUsd;
        this.status = "approved";
        this.raisedOn = raisedOn;
        this.decidedOn = raisedOn;
    }

    // A new receipt replaces the old one. Returns the old one so its file can go.
    UUID attachReceipt(UUID fileId) {
        UUID previous = receiptFileId;
        receiptFileId = fileId;
        return previous;
    }

    void cancel() {
        status = "cancelled";
    }

    boolean isApproved() {
        return "approved".equals(status);
    }

    public String getId() {
        return id;
    }

    public String getEmployeeId() {
        return employeeId;
    }

    public LocalDate getFlightDate() {
        return flightDate;
    }

    public String getRoute() {
        return route;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getCurrency() {
        return currency;
    }

    public BigDecimal getAmountUsd() {
        return amountUsd;
    }

    public UUID getReceiptFileId() {
        return receiptFileId;
    }

    public String getStatus() {
        return status;
    }

    public LocalDate getRaisedOn() {
        return raisedOn;
    }

    public String getDecidedBy() {
        return decidedBy;
    }

    public LocalDate getDecidedOn() {
        return decidedOn;
    }

    public String getDecisionNote() {
        return decisionNote;
    }
}
