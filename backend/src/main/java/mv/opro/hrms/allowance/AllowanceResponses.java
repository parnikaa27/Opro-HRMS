package mv.opro.hrms.allowance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

// Allowance shapes, matching the frontend's models field for field.
public final class AllowanceResponses {

    public record TypeResponse(String code, String name, LocalDate retiredOn) {

        static TypeResponse of(AllowanceType type) {
            return new TypeResponse(type.getCode(), type.getName(), type.getRetiredOn());
        }
    }

    // endsOn is set once it stops; one with no end is still paid.
    public record MonthlyResponse(String id, String typeCode, String typeName, BigDecimal amount, String currency, LocalDate startsOn, LocalDate endsOn,
            String note) {

        static MonthlyResponse of(MonthlyAllowance allowance, Function<String, String> typeName) {
            return new MonthlyResponse(allowance.getId(), allowance.getTypeCode(), typeName.apply(allowance.getTypeCode()), allowance.getAmount(),
                    allowance.getCurrency(), allowance.getStartsOn(), allowance.getEndsOn(), allowance.getNote());
        }
    }

    public record GrantResponse(String id, String employeeId, String employeeName, String typeCode, String typeName, BigDecimal amount, String currency,
            String reason, String status, String grantedByName, LocalDate grantedOn, String decidedByName, LocalDate decidedOn, String decisionNote) {

        static GrantResponse of(AllowanceGrant grant, Function<String, String> typeName, Map<String, String> names) {
            return new GrantResponse(grant.getId(), grant.getEmployeeId(), names.get(grant.getEmployeeId()), grant.getTypeCode(), typeName.apply(grant.getTypeCode()),
                    grant.getAmount(), grant.getCurrency(), grant.getReason(), grant.getStatus(), names.get(grant.getGrantedBy()), grant.getGrantedOn(),
                    grant.getDecidedBy() == null ? null : names.get(grant.getDecidedBy()), grant.getDecidedOn(), grant.getDecisionNote());
        }
    }

    // Someone's allowances: every monthly one, newest first, and every one-off grant.
    public record AllowancesResponse(List<MonthlyResponse> monthly, List<GrantResponse> grants) {}

    private AllowanceResponses() {}
}
