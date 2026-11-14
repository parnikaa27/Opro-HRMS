package mv.opro.hrms.employee;

import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
class PhotoController {

    private final Photos photos;
    private final CurrentUser currentUser;

    PhotoController(Photos photos, CurrentUser currentUser) {
        this.photos = photos;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/employees/{id}/photo")
    ResponseEntity<byte[]> photo(@PathVariable String id) {
        currentUser.get();
        return photos.serve(id);
    }
}
