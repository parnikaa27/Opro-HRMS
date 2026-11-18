package mv.opro.hrms.approval;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

// Whether HR approves a kind of request after the HOD. Leave types carry their own.
@Entity
class ApprovalRule {

    @Id
    private String kind;

    private boolean needsHr;

    protected ApprovalRule() {}

    boolean needsHr() {
        return needsHr;
    }

    void setNeedsHr(boolean needsHr) {
        this.needsHr = needsHr;
    }

    String getKind() {
        return kind;
    }
}
