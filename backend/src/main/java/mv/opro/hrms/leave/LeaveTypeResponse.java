package mv.opro.hrms.leave;

import java.math.BigDecimal;
import java.time.LocalDate;

// A leave type as the portal shows it. Field names match the frontend's LeaveType.
public record LeaveTypeResponse(String code, String name, boolean allowsHalfDay, boolean isUnlimited, BigDecimal defaultEntitlement,
        Integer documentRequiredAfterDays, boolean isForEveryone, boolean carriesForward, BigDecimal carryForwardCap, LocalDate retiredOn,
        boolean needsHrApproval, Integer noticeDays) {

    public static LeaveTypeResponse of(LeaveType type) {
        return new LeaveTypeResponse(type.getCode(), type.getName(), type.allowsHalfDay(), type.isUnlimited(), type.getDefaultEntitlement(),
                type.getDocumentRequiredAfterDays(), type.isForEveryone(), type.carriesForward(), type.getCarryForwardCap(), type.getRetiredOn(),
                type.needsHrApproval(), type.getNoticeDays());
    }
}
