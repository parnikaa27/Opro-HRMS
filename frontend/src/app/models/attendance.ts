export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'half-day'
  | 'absent'
  | 'incomplete'
  | 'not-in-yet'
  | 'on-leave'
  | 'holiday'
  | 'weekend';

export interface Punch {
  at: string;
  direction: 'in' | 'out';
}

export interface AttendanceDay {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  punches: Punch[];
  firstIn?: string;
  lastOut?: string;
  workedMinutes: number;
  overtimeMinutes: number;
}

export interface CorrectionRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  kind: 'missed-in' | 'missed-out';
  requestedTime: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  raisedOn: string;
}
