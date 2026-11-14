export type Role = 'EMPLOYEE' | 'MANAGER' | 'HR';

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
}

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
  employmentType: string;
  managerId?: string;
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
