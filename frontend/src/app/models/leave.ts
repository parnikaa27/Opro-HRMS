export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveType {
  code: string;
  name: string;
  allowsHalfDay: boolean;
  isUnlimited?: boolean;
  documentRequiredAfterDays?: number;
}

export interface LeaveBalance {
  type: string;
  entitled: number;
  taken: number;
  pending: number;
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
}
