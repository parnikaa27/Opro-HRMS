package mv.opro.hrms.attendance;

import org.springframework.data.jpa.repository.JpaRepository;

interface DeviceRepository extends JpaRepository<Device, String> {}
