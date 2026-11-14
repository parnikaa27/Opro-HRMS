package mv.opro.hrms.announcement;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface AnnouncementRepository extends JpaRepository<Announcement, String> {

    List<Announcement> findAllByOrderByPublishedOnDescIdDesc();
}
