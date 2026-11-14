export type Role = 'EMPLOYEE' | 'MANAGER';

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
}

export type EmployeeSummary = Pick<Employee, 'id' | 'fullName' | 'designation' | 'roles'>;
