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
  // Where it was made: an office, "Home", or an old fingerprint device's name.
  device?: string;
}

export interface AttendanceDay {
  employeeId: string;
  employeeName?: string;
  date: string;
  status: AttendanceStatus;
  punches: Punch[];
  firstIn?: string;
  lastOut?: string;
  workedMinutes: number;
  overtimeMinutes: number;
  // Set by the backend from the schedule in force that day.
  expectedOut?: string;
  scheduledMinutes?: number;
  // Punches changed by hand: an HR fix or an approved punch fix request.
  isCorrected?: boolean;
  // For days punched from the portal. A home day waits for the manager; declined, it counts as absent.
  workMode?: WorkMode;
  homeStatus?: HomeDay['status'];
}

export type WorkMode = 'office' | 'home';

export interface HomeDay {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: string;
  decidedByName?: string;
  decidedOn?: string;
  decisionNote?: string;
}

export interface WorkSchedule {
  id: string;
  effectiveFrom: string;
  shiftStart: string;
  shiftEnd: string;
  graceMinutes: number;
  halfDayMinutes: number;
  ramadanStart: string;
  ramadanEnd: string;
  reason: string;
  setBy: string;
  setByName?: string;
  setOn: string;
}

export interface PunchEdit {
  id: string;
  employeeId: string;
  date: string;
  action: 'add' | 'void';
  time: string;
  reason: string;
  by: string;
  byName?: string;
  on: string;
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
  decidedBy?: string;
  decidedOn?: string;
  decisionNote?: string;
}
