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

    @Column(name = "is_hr")
    private boolean hr;

    @Embedded
    private EmergencyContact emergencyContact;

    private LocalDate lastDay;
    private String leavingReason;

    protected Employee() {}

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

    public boolean isHr() {
        return hr;
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
