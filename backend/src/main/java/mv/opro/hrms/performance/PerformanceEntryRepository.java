package mv.opro.hrms.performance;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface PerformanceEntryRepository extends JpaRepository<PerformanceEntry, String> {

    List<PerformanceEntry> findByCycleIdAndEmployeeIdInOrderBySectionAscSortOrderAsc(String cycleId, Collection<String> employeeIds);

    void deleteByCycleIdAndEmployeeIdAndSection(String cycleId, String employeeId, String section);
}
