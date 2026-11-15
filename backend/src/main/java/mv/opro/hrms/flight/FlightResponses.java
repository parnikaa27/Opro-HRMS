package mv.opro.hrms.flight;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

// Flight allowance shapes, matching the frontend's FlightYear and FlightClaim field for field.
public final class FlightResponses {

    public record ClaimResponse(String id, String employeeId, String employeeName, LocalDate flightDate, String route, BigDecimal amount, String currency,
            BigDecimal amountUsd, boolean hasReceipt, String status, LocalDate raisedOn, String decidedByName, LocalDate decidedOn, String decisionNote) {

        public static ClaimResponse of(FlightClaim claim, Map<String, String> names) {
            return new ClaimResponse(claim.getId(), claim.getEmployeeId(), names.get(claim.getEmployeeId()), claim.getFlightDate(), claim.getRoute(),
                    claim.getAmount(), claim.getCurrency(), claim.getAmountUsd(), claim.getReceiptFileId() != null, claim.getStatus(), claim.getRaisedOn(),
                    claim.getDecidedBy() == null ? null : names.get(claim.getDecidedBy()), claim.getDecidedOn(), claim.getDecisionNote());
        }
    }

    // allowanceUsd is left out for someone who doesn't get one this year.
    public record YearResponse(int year, BigDecimal allowanceUsd, BigDecimal usedUsd, BigDecimal pendingUsd, Map<String, BigDecimal> ratesPerUsd,
            List<ClaimResponse> claims) {

        public static YearResponse of(Flights.Year year, Map<String, BigDecimal> rates, Map<String, String> names) {
            return new YearResponse(year.year(), year.allowanceUsd(), year.usedUsd(), year.pendingUsd(), rates,
                    year.claims().stream().map(claim -> ClaimResponse.of(claim, names)).toList());
        }
    }

    private FlightResponses() {}
}
