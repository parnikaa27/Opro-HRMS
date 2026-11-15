package mv.opro.hrms.notification;

import java.time.LocalDate;
import org.springframework.data.jpa.repository.JpaRepository;

interface VisaReminderRepository extends JpaRepository<VisaReminder, Long> {

    boolean existsByEmployeeIdAndDocumentAndExpiresOnAndNoticeDays(String employeeId, String document, LocalDate expiresOn, int noticeDays);
}
