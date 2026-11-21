package mv.opro.hrms.onboarding;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
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

// A new joiner's first weeks: a copy of HR's task list with real dates, ticked by HR, the HOD and the joiner, each
// their own; first-day details HR sets; and a buddy the HOD picks. Done once every task is ticked.
@Service
@Transactional(readOnly = true)
public class Onboardings {

    private static final int MAX_DAYS = 90;

    public record View(Onboarding onboarding, List<OnboardingItem> items) {}

    private final OnboardingTaskRepository tasks;
    private final OnboardingRepository onboardings;
    private final OnboardingItemRepository items;
    private final EmployeeRepository employees;
    private final People people;
    private final Notifications notifications;
    private final Clock clock;

    Onboardings(OnboardingTaskRepository tasks, OnboardingRepository onboardings, OnboardingItemRepository items, EmployeeRepository employees, People people,
            Notifications notifications, Clock clock) {
        this.tasks = tasks;
        this.onboardings = onboardings;
        this.items = items;
        this.employees = employees;
        this.people = people;
        this.notifications = notifications;
        this.clock = clock;
    }

    public Optional<View> of(String employeeId) {
        return onboardings.findById(employeeId).map(onboarding -> new View(onboarding, items.findByEmployeeIdOrderBySortOrder(employeeId)));
    }

    // Everyone still onboarding, first joiners first. For an HOD, only their reports.
    public List<View> inProgress() {
        return views(onboardings.findByCompletedOnIsNullOrderByStartsOn());
    }

    public List<View> inProgress(Collection<String> employeeIds) {
        return views(onboardings.findByEmployeeIdInAndCompletedOnIsNull(employeeIds));
    }

    // Copies HR's list with dates from their joining day. Their HOD hears what's theirs to do.
    @Transactional
    public View start(Employee joiner) {
        if (onboardings.existsById(joiner.getId())) {
            throw new ApiException(HttpStatus.CONFLICT, "Their onboarding has already started.");
        }
        LocalDate joins = joiner.getJoinedOn();
        Onboarding onboarding = onboardings.save(new Onboarding(joiner.getId(), joins));
        List<OnboardingTask> list = tasks.findAllByOrderBySortOrder();
        items.saveAll(IntStream.range(0, list.size())
                .mapToObj(index -> new OnboardingItem(Ids.next("OI"), joiner.getId(), list.get(index).getName(), list.get(index).getOwner(),
                        joins.plusDays(list.get(index).getDueInDays()), index))
                .toList());
        long forHod = list.stream().filter(task -> OnboardingItem.HOD.equals(task.getOwner())).count();
        if (joiner.getManagerId() != null) {
            notifications.tell(joiner.getManagerId(), Notification.Kind.RECORD, joiner.getFullName() + " joins your team on " + Wording.date(joins, today())
                    + "." + (forHod > 0 ? " You have " + forHod + " onboarding " + (forHod == 1 ? "task" : "tasks") + " on your Team overview." : ""));
        }
        return of(joiner.getId()).orElseThrow();
    }

    // Ticks or unticks a task. Each is its owner's: the joiner's own, their HOD's, or any HR person's but the joiner's.
    @Transactional
    public View tick(Employee reader, String employeeId, String itemId, boolean isDone) {
        Onboarding onboarding = onboardings.findById(employeeId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No onboarding for them."));
        OnboardingItem item = items.findById(itemId).filter(found -> found.getEmployeeId().equals(employeeId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Task not found"));
        if (!isOwner(reader, employeeId, item.getOwner())) {
            throw new ApiException(HttpStatus.FORBIDDEN, switch (item.getOwner()) {
                case OnboardingItem.HR -> "HR ticks this one.";
                case OnboardingItem.HOD -> "Their HOD ticks this one.";
                default -> "They tick this one themselves.";
            });
        }
        if (isDone) {
            item.tick(reader.getId(), today());
        } else {
            item.untick();
        }
        boolean isComplete = items.findByEmployeeIdOrderBySortOrder(employeeId).stream().allMatch(OnboardingItem::isDone);
        if (isComplete && onboarding.getCompletedOn() == null) {
            notifications.tell(employeeId, Notification.Kind.RECORD, "Your onboarding is done. Welcome to Opro.");
        }
        onboarding.markComplete(isComplete ? today() : null);
        return of(employeeId).orElseThrow();
    }

    // When, where and who to ask for on day one. The joiner is told.
    @Transactional
    public View setFirstDay(String employeeId, Onboarding.FirstDay firstDay) {
        Onboarding onboarding = onboardings.findById(employeeId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No onboarding for them."));
        onboarding.setFirstDay(new Onboarding.FirstDay(blankToNull(firstDay.time()), blankToNull(firstDay.place()), blankToNull(firstDay.contact())));
        notifications.tell(employeeId, Notification.Kind.RECORD, "Your first day is set. See it on your Overview.");
        return of(employeeId).orElseThrow();
    }

    // The HOD picks a colleague to show them around. Both are told.
    @Transactional
    public View setBuddy(Employee hod, String employeeId, String buddyId) {
        Onboarding onboarding = onboardings.findById(employeeId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No onboarding for them."));
        Employee buddy = people.active().stream().filter(person -> person.getId().equals(buddyId) && !person.getId().equals(employeeId)).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Pick someone at Opro other than them."));
        Employee joiner = employees.findById(employeeId).orElseThrow();
        onboarding.setBuddy(buddy.getId());
        notifications.tell(buddy.getId(), Notification.Kind.RECORD, hod.getFullName() + " asked you to be " + joiner.getFullName()
                + "'s buddy. Show them around in their first weeks.");
        notifications.tell(employeeId, Notification.Kind.RECORD, buddy.getFullName() + " is your buddy. Ask them anything in your first weeks.");
        return of(employeeId).orElseThrow();
    }

    public List<OnboardingTask> tasks() {
        return tasks.findAllByOrderBySortOrder();
    }

    // People already onboarding keep their copy.
    @Transactional
    public OnboardingTask addTask(String name, String owner, int dueInDays) {
        if (Math.abs(dueInDays) > MAX_DAYS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Keep it within " + MAX_DAYS + " days of joining.");
        }
        int sortOrder = tasks().stream().mapToInt(OnboardingTask::getSortOrder).max().orElse(0) + 1;
        return tasks.save(new OnboardingTask(Ids.next("OT"), name.strip(), owner, dueInDays, sortOrder));
    }

    @Transactional
    public void removeTask(String id) {
        tasks.delete(tasks.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Task not found")));
    }

    // Who may see someone's onboarding: them, their HOD, and HR.
    public boolean canSee(Employee reader, String employeeId) {
        return reader.getId().equals(employeeId) || reader.isHr() || isTheirHod(reader, employeeId);
    }

    private boolean isOwner(Employee reader, String employeeId, String owner) {
        return switch (owner) {
            case OnboardingItem.HR -> reader.isHr() && !reader.getId().equals(employeeId);
            case OnboardingItem.HOD -> isTheirHod(reader, employeeId);
            default -> reader.getId().equals(employeeId);
        };
    }

    public boolean isTheirHod(Employee reader, String employeeId) {
        return employees.findById(employeeId).map(Employee::getManagerId).filter(reader.getId()::equals).isPresent();
    }

    private List<View> views(List<Onboarding> found) {
        List<OnboardingItem> all = items.findByEmployeeIdInOrderBySortOrder(found.stream().map(Onboarding::getEmployeeId).toList());
        return found.stream()
                .map(onboarding -> new View(onboarding, all.stream().filter(item -> item.getEmployeeId().equals(onboarding.getEmployeeId())).toList()))
                .toList();
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}
