package mv.opro.hrms.hr;

import jakarta.servlet.http.HttpServletRequest;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.employee.Photos;
import mv.opro.hrms.files.Upload;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;

// HR puts up and takes down ID card photos. The browser has already cropped and re-encoded it to a small JPEG,
// which also strips the location data phones put in photos.
@RestController
class HrPhotoController {

    private static final int MAX_PHOTO_BYTES = Upload.MEGABYTE;

    private final HrAccess hr;
    private final CurrentUser currentUser;
    private final People people;
    private final Photos photos;
    private final Notifications notifications;

    HrPhotoController(HrAccess hr, CurrentUser currentUser, People people, Photos photos, Notifications notifications) {
        this.hr = hr;
        this.currentUser = currentUser;
        this.people = people;
        this.photos = photos;
        this.notifications = notifications;
    }

    @PutMapping("/api/hr/employees/{id}/photo")
    @Transactional
    ResponseEntity<Void> replace(@PathVariable String id, HttpServletRequest request) {
        Employee me = hr.require(currentUser.get());
        Employee employee = people.findActive(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employee not found"));
        photos.replace(employee.getId(), Upload.read(request, Upload.PHOTO, MAX_PHOTO_BYTES), me.getId());
        notifications.tell(employee.getId(), Notification.Kind.RECORD, "HR added a new photo to your ID card.");
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/hr/employees/{id}/photo")
    @Transactional
    ResponseEntity<Void> remove(@PathVariable String id) {
        hr.require(currentUser.get());
        Employee employee = people.findActive(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employee not found"));
        photos.remove(employee.getId());
        notifications.tell(employee.getId(), Notification.Kind.RECORD, "HR removed the photo from your ID card. It shows your initials for now.");
        return ResponseEntity.noContent().build();
    }
}
