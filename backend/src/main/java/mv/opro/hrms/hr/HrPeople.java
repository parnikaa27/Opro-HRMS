package mv.opro.hrms.hr;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import mv.opro.hrms.common.ApiException;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.employee.People;
import mv.opro.hrms.employee.Visa;
import mv.opro.hrms.employee.VisaRepository;
import mv.opro.hrms.exit.Exits;
import mv.opro.hrms.onboarding.Onboardings;
import mv.opro.hrms.leave.LeaveService;
import mv.opro.hrms.notification.Notification;
import mv.opro.hrms.notification.Notifications;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// HR's changes to people: hiring, details and reporting lines, leaving, and visa records. Nobody is ever deleted.
@Service
@Transactional(readOnly = true)
class HrPeople {

    // Nobody younger works at Opro. A placeholder until HR confirms it against the Employment Act.
    private static final int MINIMUM_AGE = 18;

    private static final String ID_PREFIX = "OPR-";
    private static final int ID_DIGITS = 4;

    private final EmployeeRepository employees;
    private final VisaRepository visas;
    private final People people;
    private final LeaveService leave;
    private final Notifications notifications;
    private final Exits exits;
    private final Onboardings onboardings;

    HrPeople(EmployeeRepository employees, VisaRepository visas, People people, LeaveService leave, Notifications notifications, Exits exits,
            Onboardings onboardings) {
        this.employees = employees;
        this.visas = visas;
        this.people = people;
        this.leave = leave;
        this.notifications = notifications;
        this.exits = exits;
        this.onboardings = onboardings;
    }

    // Everyone who hasn't left, people still to start included. Former staff only when HR asks for them.
    List<Employee> list(boolean includesFormer) {
        return includesFormer ? employees.findAllByOrderByFullName() : people.notLeft();
    }

    Employee find(String id) {
        return employees.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employee not found"));
    }

    @Transactional
    Employee hire(Employee.Details details) {
        employees.lockNewIds();
        String id = nextId();
        checkEmail(details.email(), id);
        checkDates(details);
        checkManager(id, details.managerId(), false);
        Employee employee = employees.save(Employee.hire(id, details));
        leave.openYearFor(employee.getId());
        onboardings.start(employee);
        return employee;
    }

    @Transactional
    Employee update(String id, Employee.Details details) {
        Employee employee = find(id);
        checkEmail(details.email(), id);
        checkDates(details);
        checkManager(id, details.managerId(), employee.isSuperAdmin());
        boolean isNewManager = details.managerId() != null && !details.managerId().equals(employee.getManagerId());
        employee.update(details);
        notifications.tell(id, Notification.Kind.RECORD, "HR updated your details."
                + (isNewManager ? " You now report to " + find(details.managerId()).getFullName() + "." : ""));
        if (isNewManager) {
            notifications.tell(details.managerId(), Notification.Kind.RECORD, employee.getFullName() + " now reports to you.");
        }
        return employee;
    }

    // A last day, with leave booked after it cancelled. Someone who still manages people has to hand them over first, and
    // someone who resigned has to hand back everything on HR's checklist.
    @Transactional
    Employee markLeaving(String id, LocalDate lastDay, String reason) {
        Employee employee = find(id);
        if (lastDay.isBefore(employee.getJoinedOn())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pick a last day after they joined.");
        }
        int reports = people.reportsOf(id).size();
        if (reports > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Move their " + reports + (reports == 1 ? " report" : " reports") + " to another manager first.");
        }
        List<String> stillOut = exits.stillOut(id);
        if (!stillOut.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "Tick off what they still have first: " + String.join(", ", stillOut).toLowerCase() + ".");
        }
        leave.cancelAfter(id, lastDay);
        employee.leave(lastDay, reason.strip());
        return employee;
    }

    @Transactional
    Employee cancelLeaving(String id) {
        Employee employee = find(id);
        if (employee.getLastDay() == null || employee.getLastDay().isBefore(people.today())) {
            throw new ApiException(HttpStatus.CONFLICT, "They have already left.");
        }
        employee.stay();
        return employee;
    }

    @Transactional
    Visa saveVisa(String id, Visa.Papers papers) {
        find(id);
        if (!papers.visaExpiry().isAfter(papers.visaIssuedOn())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Expiry must come after the issue date.");
        }
        if ((papers.employmentApprovalNumber() == null) != (papers.employmentApprovalExpiry() == null)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Give the employment approval's number and expiry together.");
        }
        Visa visa = visas.findById(id).orElseGet(() -> new Visa(id));
        visa.renew(papers);
        Visa saved = visas.save(visa);
        notifications.tell(id, Notification.Kind.VISA, "HR updated your visa and work permit details. Expiry reminders follow the new dates.");
        return saved;
    }

    private String nextId() {
        int highest = employees.findHighestId().map(id -> Integer.parseInt(id.substring(ID_PREFIX.length()))).orElse(0);
        return ID_PREFIX + String.format("%0" + ID_DIGITS + "d", highest + 1);
    }

    private void checkEmail(String email, String id) {
        if (employees.existsByEmailIgnoreCaseAndIdNot(email.strip(), id)) {
            throw new ApiException(HttpStatus.CONFLICT, "That email is already in use.");
        }
    }

    // Probation and a contract both end after someone joins.
    private static void checkDates(Employee.Details details) {
        boolean isBadEnd = Stream.of(details.probationEndsOn(), details.contractEndsOn())
                .anyMatch(end -> end != null && !end.isAfter(details.joinedOn()));
        if (isBadEnd) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Probation and contract end dates come after the joining date.");
        }
        if (details.dateOfBirth() != null && details.dateOfBirth().plusYears(MINIMUM_AGE).isAfter(details.joinedOn())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "They need to be " + MINIMUM_AGE + " by their joining date.");
        }
    }

        // Everyone but a super admin reports to someone: active, and never the person or anyone below them.
    private void checkManager(String id, String managerId, boolean isSuperAdmin) {
        if (managerId == null) {
            if (isSuperAdmin) {
                return;
            }
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pick their reporting manager.");
        }
        boolean isActive = people.findActive(managerId).isPresent();
        if (!isActive || managerId.equals(id) || below(id).contains(managerId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Pick a manager who is active and not one of their reports.");
        }
    }

    private Set<String> below(String id) {
        List<Employee> everyone = employees.findAll();
        return below(everyone, id).collect(Collectors.toSet());
    }

    private static Stream<String> below(List<Employee> everyone, String id) {
        return everyone.stream().filter(employee -> id.equals(employee.getManagerId()))
                .flatMap(report -> Stream.concat(Stream.of(report.getId()), below(everyone, report.getId())));
    }
}
