package mv.opro.hrms.attendance;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class DeviceController {

    record DeviceResponse(String id, String name, String location, boolean isOnline, OffsetDateTime lastSyncAt) {}

    private final DeviceRepository devices;

    DeviceController(DeviceRepository devices) {
        this.devices = devices;
    }

    @GetMapping("/api/devices")
    List<DeviceResponse> all() {
        return devices.findAll().stream()
                .map(device -> new DeviceResponse(device.getId(), device.getName(), device.getLocation(), device.isOnline(), device.getLastSyncAt()))
                .toList();
    }
}
