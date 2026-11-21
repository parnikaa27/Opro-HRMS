package mv.opro.hrms.performance;

import java.time.LocalDate;

// Field names match the frontend's AppraisalCycle.
public record CycleResponse(String id, String name, LocalDate dueOn, LocalDate openedOn, LocalDate closedOn) {

    public static CycleResponse of(AppraisalCycle cycle) {
        return cycle == null ? null : new CycleResponse(cycle.getId(), cycle.getName(), cycle.getDueOn(), cycle.getOpenedOn(), cycle.getClosedOn());
    }
}
