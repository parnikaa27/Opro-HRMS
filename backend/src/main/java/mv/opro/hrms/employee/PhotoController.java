package mv.opro.hrms.employee;

import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Photos", description = "Staff photos for anyone signed in. URLs carry a version, so they cache for good.")
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
