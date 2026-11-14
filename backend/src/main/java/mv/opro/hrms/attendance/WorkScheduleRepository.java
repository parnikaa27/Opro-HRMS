package mv.opro.hrms.attendance;

import org.springframework.data.jpa.repository.JpaRepository;

interface WorkScheduleRepository extends JpaRepository<WorkSchedule, String> {}
