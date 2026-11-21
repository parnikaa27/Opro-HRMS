// MANAGER is shown as HOD: anyone with people reporting to them.
export type Role = 'EMPLOYEE' | 'MANAGER' | 'HR' | 'SUPER_ADMIN';

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface Visa {
  workPermitNumber: string;
  visaNumber: string;
  passportLast4: string;
  passportExpiry: string;
  visaIssuedOn: string;
  visaExpiry: string;
  employmentApprovalNumber?: string;
  employmentApprovalExpiry?: string;
  // When the medical the work permit needs is due.
  medicalDueOn?: string;
}

export type EmploymentType = 'Permanent' | 'Contract' | 'Casual' | 'Intern';
export type Gender = 'male' | 'female';

export interface Employee {
  id: string;
  fullName: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  joinedOn: string;
  bloodGroup: string;
  nationality: string;
  workLocation: string;
  employmentType: EmploymentType;
  managerId?: string;
  gender?: Gender;
  dateOfBirth?: string;
  probationEndsOn?: string;
  contractEndsOn?: string;
  // An expatriate's quota category, from HR's quota approvals.
  jobCategory?: string;
  roles: Role[];
  emergencyContact: EmergencyContact;
  visa?: Visa;
  // Same origin and versioned, so a new photo replaces the cached one.
  photoUrl?: string;
  // Set when HR marks someone as leaving. Records stay after the last day.
  lastDay?: string;
  leavingReason?: string;
}

// What HR can set on a person. The ID, roles and visa come from elsewhere.
export type EmployeeDetails = Omit<Employee, 'id' | 'roles' | 'visa' | 'photoUrl' | 'lastDay' | 'leavingReason'>;

export type EmployeeSummary = Pick<Employee, 'id' | 'fullName' | 'designation' | 'roles'>;

// All anyone at Opro may see of a colleague.
export type Colleague = Pick<Employee, 'id' | 'fullName' | 'designation' | 'department' | 'email' | 'photoUrl'>;
