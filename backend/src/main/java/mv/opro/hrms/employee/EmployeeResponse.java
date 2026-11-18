package mv.opro.hrms.employee;

import java.time.LocalDate;
import java.util.List;

// The employee as the portal sees them. Field names match the frontend's Employee model.
public record EmployeeResponse(
        String id,
        String fullName,
        String designation,
        String department,
        String email,
        String phone,
        LocalDate joinedOn,
        String bloodGroup,
        String nationality,
        String workLocation,
        String employmentType,
        String managerId,
        List<Role> roles,
        EmergencyContact emergencyContact,
        VisaResponse visa,
        String photoUrl,
        LocalDate lastDay,
        String leavingReason,
        String gender,
        LocalDate dateOfBirth,
        LocalDate probationEndsOn,
        LocalDate contractEndsOn,
        String jobCategory) {

    public record VisaResponse(
            String workPermitNumber,
            String visaNumber,
            String passportLast4,
            LocalDate passportExpiry,
            LocalDate visaIssuedOn,
            LocalDate visaExpiry,
            String employmentApprovalNumber,
            LocalDate employmentApprovalExpiry,
            LocalDate medicalDueOn) {

        public static VisaResponse of(Visa visa) {
            return new VisaResponse(visa.getWorkPermitNumber(), visa.getVisaNumber(), visa.getPassportLast4(),
                    visa.getPassportExpiry(), visa.getVisaIssuedOn(), visa.getVisaExpiry(), visa.getEmploymentApprovalNumber(),
                    visa.getEmploymentApprovalExpiry(), visa.getMedicalDueOn());
        }
    }

    public static EmployeeResponse of(Employee employee, List<Role> roles, Visa visa, String photoUrl) {
        return new EmployeeResponse(employee.getId(), employee.getFullName(), employee.getDesignation(), employee.getDepartment(),
                employee.getEmail(), employee.getPhone(), employee.getJoinedOn(), employee.getBloodGroup(), employee.getNationality(),
                employee.getWorkLocation(), employee.getEmploymentType(), employee.getManagerId(), roles, employee.getEmergencyContact(),
                visa == null ? null : VisaResponse.of(visa), photoUrl, employee.getLastDay(), employee.getLeavingReason(),
                employee.getGender(), employee.getDateOfBirth(), employee.getProbationEndsOn(), employee.getContractEndsOn(), employee.getJobCategory());
    }
}
