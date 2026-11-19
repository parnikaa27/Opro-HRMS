package mv.opro.hrms.exit;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

// A resignation as the portal shows it, matching the frontend's Resignation. checklist is empty until it's approved;
// each item's outcome is returned, not-given, or null while it's still out.
public record ResignationResponse(String id, String employeeId, String employeeName, LocalDate submittedOn, String reason, LocalDate releaseOn,
        String status, String hodApprovedByName, LocalDate hodApprovedOn, String decidedByName, LocalDate decidedOn, String decisionNote,
        LocalDate exitOn, List<ChecklistItem> checklist) {

    public record ChecklistItem(String itemId, String name, String outcome, LocalDate tickedOn) {}

    public static ResignationResponse of(Exits.View view, Map<String, String> names) {
        Resignation resignation = view.resignation();
        return new ResignationResponse(resignation.getId(), resignation.getEmployeeId(), names.get(resignation.getEmployeeId()),
                resignation.getSubmittedOn(), resignation.getReason(), resignation.getReleaseOn(), resignation.getStatus(),
                resignation.getHodApprovedBy() == null ? null : names.get(resignation.getHodApprovedBy()), resignation.getHodApprovedOn(),
                resignation.getDecidedBy() == null ? null : names.get(resignation.getDecidedBy()), resignation.getDecidedOn(),
                resignation.getDecisionNote(), resignation.getExitOn(), view.checklist().stream()
                        .map(item -> new ChecklistItem(item.item().getId(), item.item().getName(), item.ticked() == null ? null : item.ticked().getOutcome(),
                                item.ticked() == null ? null : item.ticked().getTickedOn()))
                        .toList());
    }

    static ResignationResponse of(Resignation resignation, Map<String, String> names) {
        return of(new Exits.View(resignation, List.of()), names);
    }
}
