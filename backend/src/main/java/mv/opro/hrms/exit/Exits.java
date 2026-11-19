package mv.opro.hrms.exit;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.common.Ids;
import mv.opro.hrms.common.Wording;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Leaving Opro by resigning: the person puts it in, their HOD approves, then HR approves and sets the exit date. Then
// HR ticks off everything that comes back, and only then can they be marked as leaving.
@Service
@Transactional(readOnly = true)
public class Exits {

    private static final String WHAT = "resignation";
    private static final List<String> OPEN = List.of(Resignation.PENDING, Resignation.APPROVED);

    // A resignation and, once approved, each item on HR's list with how it was ticked off (null while it's still out).
    public record View(Resignation resignation, List<Item> checklist) {}

    public record Item(ExitItem item, ExitReturn ticked) {}

    private final ResignationRepository resignations;
    private final ExitItemRepository items;
    private final ExitReturnRepository returns;
    private final EmployeeRepository employees;
    private final People people;
    private final Notifications notifications;
    private final Clock clock;

    Exits(ResignationRepository resignations, ExitItemRepository items, ExitReturnRepository returns, EmployeeRepository employees, People people,
            Notifications notifications, Clock clock) {
        this.resignations = resignations;
        this.items = items;
        this.returns = returns;
        this.employees = employees;
        this.people = people;
        this.notifications = notifications;
        this.clock = clock;
    }

    public List<View> of(String employeeId) {
        return resignations.findByEmployeeIdOrderBySubmittedOnDescIdDesc(employeeId).stream().map(this::view).toList();
    }

    // Their HOD hears. Someone with no HOD, a super admin, goes straight to HR.
    @Transactional
    public View resign(Employee employee, String reason, LocalDate releaseOn) {
        employees.lockById(employee.getId());
        LocalDate today = today();
        if (employee.getLastDay() != null) {
            throw new ApiException(HttpStatus.CONFLICT, "HR has already set your last day.");
        }
        if (resignations.existsByEmployeeIdAndStatusIn(employee.getId(), OPEN)) {
            throw new ApiException(HttpStatus.CONFLICT, "You've already resigned. Withdraw that one first if the dates have changed.");
        }
        if (!releaseOn.isAfter(today)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pick a last day after today.");
        }
        Resignation resignation = resignations.save(new Resignation(Ids.next("RS"), employee.getId(), today, reason.strip(), releaseOn));
        String asked = employee.getFullName() + " resigned, asking for " + Wording.date(releaseOn, today) + " as their last day.";
        if (employee.getManagerId() == null) {
            resignation.approveForHod(null, today);
            hr(employee.getId()).forEach(id -> notifications.tell(id, Notification.Kind.APPROVAL, asked + " Decide it from Inbox."));
        } else {
            notifications.tell(employee.getManagerId(), Notification.Kind.APPROVAL, asked + " Decide it from Leave requests.");
        }
        return view(resignation);
    }

    // While it waits, they can take it back.
    @Transactional
    public View withdraw(Employee employee, String id) {
        Resignation resignation = resignations.findById(id).filter(found -> found.getEmployeeId().equals(employee.getId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Resignation not found"));
        if (!resignation.isPending()) {
            throw new ApiException(HttpStatus.CONFLICT, "It's been decided, so talk to HR about it.");
        }
        resignation.withdraw(today());
        return view(resignation);
    }

    // The HOD's reports' resignations, or everyone's for a super admin. No status means all.
    public List<Resignation> forTeam(Collection<String> employeeIds, String status) {
        return status == null
                ? resignations.findByEmployeeIdInOrderBySubmittedOnDesc(employeeIds)
                : resignations.findByEmployeeIdInAndStatusOrderBySubmittedOnDesc(employeeIds, status);
    }

    // The HOD step. Approving passes it to HR, unless the HOD is HR: then it's approved with their asked for day.
    @Transactional
    public Resignation decideAsHod(Employee hod, String id, Collection<String> inScope, String decision, String note) {
        Resignation resignation = resignations.findById(id).filter(found -> inScope.contains(found.getEmployeeId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Resignation not found"));
        if (!resignation.isPending()) {
            throw new ApiException(HttpStatus.CONFLICT, "This resignation has already been decided.");
        }
        if (resignation.isWaitingForHr()) {
            throw new ApiException(HttpStatus.CONFLICT, "Their HOD approved this. It now waits for HR.");
        }
        if (!Resignation.APPROVED.equals(decision)) {
            return reject(hod, resignation, note);
        }
        if (hod.isHr()) {
            return approve(hod, resignation, resignation.getReleaseOn());
        }
        resignation.approveForHod(hod.getId(), today());
        String name = people.namesOf(List.of(resignation.getEmployeeId())).get(resignation.getEmployeeId());
        notifications.tell(resignation.getEmployeeId(), Notification.Kind.RECORD, hod.getFullName() + " approved your " + WHAT + ". It now waits for HR.");
        hr(resignation.getEmployeeId()).forEach(hrId -> notifications.tell(hrId, Notification.Kind.APPROVAL, hod.getFullName() + " approved " + name
                + "'s " + WHAT + ". It needs HR too. Decide it from Inbox."));
        return resignation;
    }

    // What waits for HR, never the reader's own.
    public List<Resignation> waitingForHr(Employee hr) {
        return resignations.findByStatusAndHodApprovedOnNotNullOrderBySubmittedOn(Resignation.PENDING).stream()
                .filter(resignation -> !resignation.getEmployeeId().equals(hr.getId()))
                .toList();
    }

    // HR's step sets the exit date: the day they asked for, unless HR gives another.
    @Transactional
    public Resignation decideAsHr(Employee hr, String id, String decision, LocalDate exitOn, String note) {
        Resignation resignation = resignations.findById(id).filter(Resignation::isWaitingForHr)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Nothing waiting for HR with that id"));
        if (hr.getId().equals(resignation.getEmployeeId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Your own requests go to another HR person.");
        }
        if (!Resignation.APPROVED.equals(decision)) {
            return reject(hr, resignation, note);
        }
        LocalDate exit = exitOn == null ? resignation.getReleaseOn() : exitOn;
        if (exit.isBefore(today())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pick an exit date from today on.");
        }
        return approve(hr, resignation, exit);
    }

    // Their approved resignation, with its checklist. Empty when they haven't resigned.
    public Optional<View> exitOf(String employeeId) {
        return resignations.findFirstByEmployeeIdAndStatus(employeeId, Resignation.APPROVED).map(this::view);
    }

    // Ticks an item off: returned, or never given. Untick by passing no outcome.
    @Transactional
    public View tick(Employee hr, String employeeId, String itemId, String outcome) {
        Resignation resignation = resignations.findFirstByEmployeeIdAndStatus(employeeId, Resignation.APPROVED)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "They haven't resigned."));
        ExitItem item = items.findById(itemId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Item not found"));
        ExitReturn.Key key = new ExitReturn.Key(resignation.getId(), item.getId());
        if (outcome == null) {
            returns.deleteById(key);
        } else {
            returns.save(new ExitReturn(resignation.getId(), item.getId(), outcome, hr.getId(), today()));
        }
        return view(resignation);
    }

    // What's still out for someone with an approved resignation. Marking them as leaving waits until it's empty.
    public List<String> stillOut(String employeeId) {
        return resignations.findFirstByEmployeeIdAndStatus(employeeId, Resignation.APPROVED).map(this::view).stream()
                .flatMap(view -> view.checklist().stream())
                .filter(item -> item.ticked() == null)
                .map(item -> item.item().getName())
                .toList();
    }

    public List<ExitItem> items() {
        return items.findAllByOrderBySortOrderAscNameAsc();
    }

    @Transactional
    public ExitItem addItem(String name) {
        String clean = name.strip();
        if (items.existsByNameIgnoreCase(clean)) {
            throw new ApiException(HttpStatus.CONFLICT, "That's already on the list.");
        }
        int sortOrder = items().stream().mapToInt(ExitItem::getSortOrder).max().orElse(0) + 1;
        return items.save(new ExitItem(Ids.next("EI"), clean, sortOrder));
    }

    // Ticks already made for it go with it.
    @Transactional
    public void removeItem(String id) {
        items.delete(items.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Item not found")));
    }

    private Resignation reject(Employee by, Resignation resignation, String note) {
        String clean = note == null || note.isBlank() ? null : note.strip();
        if (clean == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Give a short reason so they know where they stand.");
        }
        resignation.reject(by.getId(), today(), clean);
        notifications.tell(resignation.getEmployeeId(), Notification.Kind.RECORD, by.getFullName() + " didn't accept your " + WHAT + ": "
                + Wording.sentence(clean) + " Talk to them about what happens next.");
        return resignation;
    }

    // They hear their exit date and what to bring back. Their HOD hears the date too.
    private Resignation approve(Employee by, Resignation resignation, LocalDate exitOn) {
        resignation.approve(by.getId(), today(), exitOn);
        String date = Wording.date(exitOn, today());
        String bring = items().stream().map(item -> item.getName().toLowerCase()).collect(Collectors.joining(", "));
        notifications.tell(resignation.getEmployeeId(), Notification.Kind.RECORD, "Your " + WHAT + " was accepted. Your exit date is " + date + "."
                + (bring.isEmpty() ? "" : " Before you go, return your " + bring + " to HR."));
        Employee person = employees.findById(resignation.getEmployeeId()).orElseThrow();
        if (person.getManagerId() != null && !person.getManagerId().equals(by.getId())) {
            notifications.tell(person.getManagerId(), Notification.Kind.RECORD, person.getFullName() + "'s exit date is " + date + ".");
        }
        return resignation;
    }

    private View view(Resignation resignation) {
        if (!resignation.isApproved()) {
            return new View(resignation, List.of());
        }
        Map<String, ExitReturn> ticked = returns.findByResignationId(resignation.getId()).stream()
                .collect(Collectors.toMap(ExitReturn::getItemId, Function.identity()));
        return new View(resignation, items().stream().map(item -> new Item(item, ticked.get(item.getId()))).toList());
    }

    // Everyone in HR but the person themselves.
    private List<String> hr(String employeeId) {
        return people.active().stream().filter(Employee::isHr).map(Employee::getId).filter(id -> !id.equals(employeeId)).toList();
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}
