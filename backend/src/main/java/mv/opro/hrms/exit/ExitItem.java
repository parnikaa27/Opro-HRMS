package mv.opro.hrms.exit;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

// Something HR collects back before someone leaves, like a laptop or accommodation keys.
@Entity
public class ExitItem {

    @Id
    private String id;

    private String name;
    private int sortOrder;

    protected ExitItem() {}

    ExitItem(String id, String name, int sortOrder) {
        this.id = id;
        this.name = name;
        this.sortOrder = sortOrder;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    int getSortOrder() {
        return sortOrder;
    }
}
