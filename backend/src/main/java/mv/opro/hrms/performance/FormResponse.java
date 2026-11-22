package mv.opro.hrms.performance;

import java.time.LocalDate;
import java.util.Map;

// Where someone's plan for the open cycle stands: their goals and the four other sections go through the HOD, then HR, together.
// Field names match the frontend's AppraisalForm.
public record FormResponse(String status, LocalDate submittedOn, String hodApprovedByName, LocalDate hodApprovedOn, String decidedByName, LocalDate decidedOn,
        String note) {

    // Nobody has started: a draft with nothing written.
    static final FormResponse NOT_STARTED = new FormResponse(AppraisalForm.DRAFT, null, null, null, null, null, null);

    static FormResponse of(AppraisalForm form, Map<String, String> names) {
        if (form == null) {
            return NOT_STARTED;
        }
        return new FormResponse(form.getStatus(), form.getSubmittedOn(), form.getHodApprovedBy() == null ? null : names.get(form.getHodApprovedBy()),
                form.getHodApprovedOn(), form.getDecidedBy() == null ? null : names.get(form.getDecidedBy()), form.getDecidedOn(), form.getNote());
    }
}
