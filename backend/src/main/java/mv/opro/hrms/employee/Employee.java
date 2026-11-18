package mv.opro.hrms.employee;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import java.time.LocalDate;

@Entity
public class Employee {

    @Id
    private String id;

    private String fullName;
    private String designation;
    private String department;
    private String email;
    private String phone;
    private LocalDate joinedOn;
    private String bloodGroup;
    private String nationality;
    private String workLocation;
    private String employmentType;
    private String managerId;
    private String gender;
    private LocalDate dateOfBirth;
    private LocalDate probationEndsOn;
    private LocalDate contractEndsOn;
    private String jobCategory;

    @Column(name = "is_hr")
    private boolean hr;

    @Column(name = "is_super_admin")
    private boolean superAdmin;

    @Embedded
    private EmergencyContact emergencyContact;

    private LocalDate lastDay;
    private String leavingReason;

    protected Employee() {}

    // What HR sets on a person. Roles are worked out, the visa and photo have their own steps.
    // jobCategory is where an expatriate's quota slot comes from.
    public record Details(String fullName, String designation, String department, String email, String phone, LocalDate joinedOn,
            String bloodGroup, String nationality, String workLocation, String employmentType, String managerId,
            EmergencyContact emergencyContact, String gender, LocalDate dateOfBirth, LocalDate probationEndsOn, LocalDate contractEndsOn,
            String jobCategory) {}

    public static Employee hire(String id, Details details) {
        Employee employee = new Employee();
        employee.id = id;
        employee.update(details);
        return employee;
    }

    public void update(Details details) {
        fullName = details.fullName();
        designation = details.designation();
        department = details.department();
        email = details.email();
        phone = details.phone();
        joinedOn = details.joinedOn();
        bloodGroup = details.bloodGroup();
        nationality = details.nationality();
        workLocation = details.workLocation();
        employmentType = details.employmentType();
        managerId = details.managerId();
        emergencyContact = details.emergencyContact();
        gender = details.gender();
        dateOfBirth = details.dateOfBirth();
        probationEndsOn = details.probationEndsOn();
        contractEndsOn = details.contractEndsOn();
        jobCategory = details.jobCategory();
    }

    public void leave(LocalDate day, String reason) {
        lastDay = day;
        leavingReason = reason;
    }

    public void stay() {
        lastDay = null;
        leavingReason = null;
    }

    // Someone past their last day keeps their records but can no longer sign in or show up in live lists.
    public boolean isActiveOn(LocalDate day) {
        return lastDay == null || !lastDay.isBefore(day);
    }

    public String getId() {
        return id;
    }

    public String getFullName() {
        return fullName;
    }

    public String getDesignation() {
        return designation;
    }

    public String getDepartment() {
        return department;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public LocalDate getJoinedOn() {
        return joinedOn;
    }

    public String getBloodGroup() {
        return bloodGroup;
    }

    public String getNationality() {
        return nationality;
    }

    public String getWorkLocation() {
        return workLocation;
    }

    public String getEmploymentType() {
        return employmentType;
    }

    public String getManagerId() {
        return managerId;
    }

    public String getGender() {
        return gender;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public LocalDate getProbationEndsOn() {
        return probationEndsOn;
    }

    public LocalDate getContractEndsOn() {
        return contractEndsOn;
    }

    public String getJobCategory() {
        return jobCategory;
    }

    public boolean isHr() {
        return hr;
    }

    public boolean isSuperAdmin() {
        return superAdmin;
    }

    public EmergencyContact getEmergencyContact() {
        return emergencyContact;
    }

    public LocalDate getLastDay() {
        return lastDay;
    }

    public String getLeavingReason() {
        return leavingReason;
    }
}
