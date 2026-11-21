package mv.opro.hrms.onboarding;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface OnboardingTaskRepository extends JpaRepository<OnboardingTask, String> {

    List<OnboardingTask> findAllByOrderBySortOrder();
}
