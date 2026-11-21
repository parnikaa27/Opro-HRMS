package mv.opro.hrms.document;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import java.io.Serializable;

// One person HR asks for a document type that isn't for everyone.
@Entity
@IdClass(DocumentTypePerson.Key.class)
class DocumentTypePerson {

    record Key(String typeCode, String employeeId) implements Serializable {}

    @Id
    private String typeCode;

    @Id
    private String employeeId;

    protected DocumentTypePerson() {}

    DocumentTypePerson(String typeCode, String employeeId) {
        this.typeCode = typeCode;
        this.employeeId = employeeId;
    }

    String getTypeCode() {
        return typeCode;
    }
}
