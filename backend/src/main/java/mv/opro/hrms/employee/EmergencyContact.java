package mv.opro.hrms.employee;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public record EmergencyContact(
        @Column(name = "emergency_name") String name,
        @Column(name = "emergency_relation") String relation,
        @Column(name = "emergency_phone") String phone) {}
