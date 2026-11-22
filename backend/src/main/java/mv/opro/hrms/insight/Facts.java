package mv.opro.hrms.insight;

import java.time.Clock;
import java.time.LocalDate;
import java.time.Period;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import mv.opro.hrms.employee.Employee;
import mv.opro.hrms.employee.EmployeeRepository;
import mv.opro.hrms.employee.Visa;
import mv.opro.hrms.employee.VisaRepository;
import mv.opro.hrms.record.MedicalInsurance;
import mv.opro.hrms.record.Records;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Everyone at Opro, past staff included, with the papers that expire. The dashboard and the reports count from these.
@Service
@Transactional(readOnly = true)
class Facts {

    static final int EXPIRY_WARNING_DAYS = 60;
    private static final String NATIONAL = "Maldivian";
    private static final int PERCENT = 100;
    // Age bands of ten years: under 25, 25 to 34 and so on, up to 55 and over.
    private static final int FIRST_BAND_STARTS = 25;
    private static final int LAST_BAND_STARTS = 55;
    private static final int BAND_YEARS = 10;

    record Person(Employee employee, Visa visa, LocalDate insuranceExpiry) {

        String id() {
            return employee.getId();
        }

        String fullName() {
            return employee.getFullName();
        }

        boolean isExpatriate() {
            return !NATIONAL.equals(employee.getNationality());
        }
    }

    enum Paper {
        VISA("Visa"), PASSPORT("Passport"), APPROVAL("Employment approval"), MEDICAL("Work permit medical"), INSURANCE("Medical insurance");

        final String label;

        Paper(String label) {
            this.label = label;
        }

        LocalDate of(Person person) {
            if (this == INSURANCE) {
                return person.insuranceExpiry();
            }
            Visa visa = person.visa();
            if (visa == null) {
                return null;
            }
            return switch (this) {
                case VISA -> visa.getVisaExpiry();
                case PASSPORT -> visa.getPassportExpiry();
                case APPROVAL -> visa.getEmploymentApprovalExpiry();
                default -> visa.getMedicalDueOn();
            };
        }
    }

    // A group with its count and its share of the whole.
    record Share(String label, int count, int percent) {}

    private final EmployeeRepository employees;
    private final VisaRepository visas;
    private final Records records;
    private final Clock clock;

    Facts(EmployeeRepository employees, VisaRepository visas, Records records, Clock clock) {
        this.employees = employees;
        this.visas = visas;
        this.records = records;
        this.clock = clock;
    }

    LocalDate today() {
        return LocalDate.now(clock);
    }

    // By name.
    List<Person> everyone() {
        Map<String, Visa> visaOf = visas.findAll().stream().collect(Collectors.toMap(Visa::getEmployeeId, Function.identity()));
        Map<String, LocalDate> insuranceOf = records.allInsurance().stream()
                .collect(Collectors.toMap(MedicalInsurance::getEmployeeId, MedicalInsurance::getExpiresOn));
        return employees.findAll().stream()
                .sorted(Comparator.comparing(Employee::getFullName))
                .map(employee -> new Person(employee, visaOf.get(employee.getId()), insuranceOf.get(employee.getId())))
                .toList();
    }

    // Joined by today and not left.
    static List<Person> active(List<Person> people, LocalDate today) {
        return people.stream().filter(person -> person.employee().isActiveOn(today)).toList();
    }

    static int percentOf(long part, long whole) {
        return whole > 0 ? (int) Math.round((double) part * PERCENT / whole) : 0;
    }

    static long daysUntil(LocalDate date, LocalDate today) {
        return ChronoUnit.DAYS.between(today, date);
    }

    // Biggest first, then by name.
    static <T> List<Share> shares(List<T> items, Function<T, String> labelOf) {
        Map<String, Long> counts = items.stream().collect(Collectors.groupingBy(labelOf, LinkedHashMap::new, Collectors.counting()));
        return counts.entrySet().stream()
                .map(entry -> new Share(entry.getKey(), entry.getValue().intValue(), percentOf(entry.getValue(), items.size())))
                .sorted(Comparator.comparingInt(Share::count).reversed().thenComparing(Share::label))
                .toList();
    }

    static String ageBand(LocalDate dateOfBirth, LocalDate today) {
        if (dateOfBirth == null) {
            return "Not recorded";
        }
        int age = Period.between(dateOfBirth, today).getYears();
        if (age < FIRST_BAND_STARTS) {
            return "Under " + FIRST_BAND_STARTS;
        }
        int start = Math.min(LAST_BAND_STARTS, FIRST_BAND_STARTS + (age - FIRST_BAND_STARTS) / BAND_YEARS * BAND_YEARS);
        return start == LAST_BAND_STARTS ? LAST_BAND_STARTS + " and over" : start + " to " + (start + BAND_YEARS - 1);
    }

    static String genderLabel(Employee employee) {
        return switch (employee.getGender() == null ? "" : employee.getGender()) {
            case "female" -> "Female";
            case "male" -> "Male";
            default -> "Not recorded";
        };
    }
}
