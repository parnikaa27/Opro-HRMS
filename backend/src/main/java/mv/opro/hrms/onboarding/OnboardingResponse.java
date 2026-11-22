package mv.opro.hrms.onboarding;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

// Someone's onboarding as the portal shows it, matching the frontend's Onboarding. Each item's owner is hr, hod or joiner.
public record OnboardingResponse(String employeeId, String employeeName, String designation, LocalDate startsOn, String firstDayTime, String firstDayPlace,
        String firstDayContact, String hodName, String buddyId, String buddyName, LocalDate completedOn, List<ItemResponse> items) {

    public record ItemResponse(String id, String name, String owner, LocalDate dueOn, LocalDate doneOn, String doneByName) {}

    // The person's own fields come from people: name, designation and HOD.
    record Person(String fullName, String designation, String managerId) {}

    static OnboardingResponse of(Onboardings.View view, Person person, Map<String, String> names) {
        Onboarding onboarding = view.onboarding();
        Onboarding.FirstDay firstDay = onboarding.getFirstDay();
        return new OnboardingResponse(onboarding.getEmployeeId(), person.fullName(), person.designation(), onboarding.getStartsOn(), firstDay.time(),
                firstDay.place(), firstDay.contact(), person.managerId() == null ? null : names.get(person.managerId()), onboarding.getBuddyId(),
                onboarding.getBuddyId() == null ? null : names.get(onboarding.getBuddyId()), onboarding.getCompletedOn(), view.items().stream()
                        .map(item -> new ItemResponse(item.getId(), item.getName(), item.getOwner(), item.getDueOn(), item.getDoneOn(),
                                item.getDoneBy() == null ? null : names.get(item.getDoneBy())))
                        .toList());
    }
}
