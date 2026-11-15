package mv.opro.hrms.notification;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findTop50ByEmployeeIdOrderByCreatedOnDescIdDesc(String employeeId);

    @Modifying
    @Query("update Notification n set n.isRead = true where n.employeeId = :employeeId and n.isRead = false")
    void markAllRead(String employeeId);
}
