import { AttendanceDay } from './attendance';
import { EmploymentType, Gender } from './employee';
import { LeaveRequest } from './leave';
import { Quota } from './record';

// One person as the dashboard and reports see them, past staff included. Field names match Spring's InsightController.
export interface PersonFact {
  id: string;
  fullName: string;
  department: string;
  designation: string;
  nationality: string;
  gender?: Gender;
  dateOfBirth?: string;
  joinedOn: string;
  lastDay?: string;
  employmentType: EmploymentType;
  jobCategory?: string;
  managerId?: string;
  // Missing for people who have left.
  today?: AttendanceDay;
  visaExpiry?: string;
  passportExpiry?: string;
  employmentApprovalExpiry?: string;
  medicalDueOn?: string;
  insuranceExpiry?: string;
  probationEndsOn?: string;
  contractEndsOn?: string;
}

export type LeaveFact = Pick<LeaveRequest, 'employeeId' | 'type' | 'from' | 'to' | 'days' | 'status' | 'appliedOn'>;

export interface BalanceFact {
  employeeId: string;
  type: string;
  entitled: number;
  taken: number;
  pending: number;
}

export interface Insights {
  today: string;
  people: PersonFact[];
  leave: LeaveFact[];
  balances: BalanceFact[];
  quotas: Quota[];
}
