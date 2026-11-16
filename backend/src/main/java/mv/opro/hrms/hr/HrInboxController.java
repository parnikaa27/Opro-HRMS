package mv.opro.hrms.hr;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import mv.opro.hrms.announcement.Announcement;
import mv.opro.hrms.announcement.AnnouncementEditor;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.profile.ChangeRequest;
import mv.opro.hrms.profile.ChangeRequests;
import mv.opro.hrms.session.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.tags.Tag;

// The profile change request inbox and the announcements HR posts.
@Tag(name = "HR: inbox", description = "Profile change requests and announcements. HR only.")
@RestController
class HrInboxController {

    private static final int MAX_NOTE = 300;
    private static final int MAX_TITLE = 80;
    private static final int MAX_BODY = 500;

    record Decision(@NotNull @Pattern(regexp = "done|declined") String decision, @Size(max = MAX_NOTE) String note) {}

    record ChangeRequestResponse(String id, String employeeId, String employeeName, String field, String details, String status, LocalDate raisedOn,
            LocalDate decidedOn, String decisionNote) {

        static ChangeRequestResponse of(ChangeRequest request, Map<String, String> names) {
            return new ChangeRequestResponse(request.getId(), request.getEmployeeId(), names.get(request.getEmployeeId()), request.getField(),
                    request.getDetails(), request.getStatus(), request.getRaisedOn(), request.getDecidedOn(), request.getDecisionNote());
        }
    }

    record AnnouncementBody(@NotBlank @Size(max = MAX_TITLE) String title, @NotBlank @Size(max = MAX_BODY) String body) {}

    record AnnouncementResponse(String id, String title, String body, LocalDate publishedOn) {

        static AnnouncementResponse of(Announcement note) {
            return new AnnouncementResponse(note.getId(), note.getTitle(), note.getBody(), note.getPublishedOn());
        }
    }

    private final HrAccess hr;
    private final CurrentUser currentUser;
    private final People people;
    private final ChangeRequests changeRequests;
    private final AnnouncementEditor announcements;

    HrInboxController(HrAccess hr, CurrentUser currentUser, People people, ChangeRequests changeRequests, AnnouncementEditor announcements) {
        this.hr = hr;
        this.currentUser = currentUser;
        this.people = people;
        this.changeRequests = changeRequests;
        this.announcements = announcements;
    }

    @GetMapping("/api/hr/change-requests")
    List<ChangeRequestResponse> changeRequests() {
        hr.require(currentUser.get());
        List<ChangeRequest> requests = changeRequests.all();
        Map<String, String> names = people.namesOf(requests.stream().map(ChangeRequest::getEmployeeId).collect(Collectors.toSet()));
        return requests.stream().map(request -> ChangeRequestResponse.of(request, names)).toList();
    }

    @PostMapping("/api/hr/change-requests/{id}/decision")
    ChangeRequestResponse decide(@PathVariable String id, @Valid @RequestBody Decision body) {
        ChangeRequest request = changeRequests.decide(hr.require(currentUser.get()), id, body.decision(), body.note());
        return ChangeRequestResponse.of(request, people.namesOf(List.of(request.getEmployeeId())));
    }

    @PostMapping("/api/hr/announcements")
    AnnouncementResponse post(@Valid @RequestBody AnnouncementBody body) {
        hr.require(currentUser.get());
        return AnnouncementResponse.of(announcements.post(body.title(), body.body()));
    }

    @PutMapping("/api/hr/announcements/{id}")
    AnnouncementResponse update(@PathVariable String id, @Valid @RequestBody AnnouncementBody body) {
        hr.require(currentUser.get());
        return AnnouncementResponse.of(announcements.update(id, body.title(), body.body()));
    }

    @DeleteMapping("/api/hr/announcements/{id}")
    ResponseEntity<Void> delete(@PathVariable String id) {
        hr.require(currentUser.get());
        announcements.delete(id);
        return ResponseEntity.noContent().build();
    }
}
