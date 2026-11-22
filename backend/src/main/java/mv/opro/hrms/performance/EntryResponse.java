package mv.opro.hrms.performance;

import java.time.LocalDate;

// Field names match the frontend's PlanEntry.
public record EntryResponse(String id, String section, String title, String details, LocalDate targetOn) {

    static EntryResponse of(PerformanceEntry entry) {
        return new EntryResponse(entry.getId(), entry.getSection(), entry.getTitle(), entry.getDetails(), entry.getTargetOn());
    }
}
