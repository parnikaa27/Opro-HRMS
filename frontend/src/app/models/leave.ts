export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveType {
  code: string;
  name: string;
  allowsHalfDay: boolean;
  isUnlimited?: boolean;
  defaultEntitlement?: number;
  documentRequiredAfterDays?: number;
  // Everyone gets it each year, or HR gives it to people one by one (maternity, marriage).
  isForEveryone?: boolean;
  // Unused days move into the next year, up to the cap. Otherwise they lapse.
  carriesForward?: boolean;
  carryForwardCap?: number;
  // No longer offered. Kept so past requests still have a name.
  retiredOn?: string;
}

// Compensatory off is earned for days off worked. The policy never gives it.
export const COMP_OFF = 'comp-off';

export interface LeaveBalance {
  type: string;
  // Includes anything carried forward from last year.
  entitled: number;
  taken: number;
  pending: number;
  carriedOver?: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  type: string;
  from: string;
  to: string;
  halfDay?: 'first' | 'second';
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  decidedBy?: string;
  decidedByName?: string;
  decidedOn?: string;
  decisionNote?: string;
  recordedByHr?: boolean;
  hasCertificate?: boolean;
}

export interface BalanceAdjustment {
  id: string;
  employeeId: string;
  type: string;
  days: number;
  reason: string;
  by: string;
  byName?: string;
  on: string;
}
