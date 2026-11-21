package mv.opro.hrms.onboarding;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface OnboardingRepository extends JpaRepository<Onboarding, String> {

    List<Onboarding> findByCompletedOnIsNullOrderByStartsOn();

    List<Onboarding> findByEmployeeIdInAndCompletedOnIsNull(Collection<String> employeeIds);
}
