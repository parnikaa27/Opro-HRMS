package mv.opro.hrms.onboarding;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface OnboardingItemRepository extends JpaRepository<OnboardingItem, String> {

    List<OnboardingItem> findByEmployeeIdOrderBySortOrder(String employeeId);

    List<OnboardingItem> findByEmployeeIdInOrderBySortOrder(Collection<String> employeeIds);
}
