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
  // Past the end of the shift on a working day, from half an hour. The HOD approves it separately.
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

export type WorkMode = 'office' | 'resort' | 'home';

// Why someone asks for a punch fix. A late punch moves their punch in; the rest add the punch they missed.
export type FixCategory = 'resort' | 'forgot' | 'late' | 'other';

// A Friday or public holiday worked. days is what it earns, decided or what approving would give.
export interface CompOffClaim {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  days: number;
  workedMinutes: number;
  decidedByName?: string;
  decidedOn?: string;
  decisionNote?: string;
  // Set while it waits for HR after the HOD approved.
  hodApprovedByName?: string;
  hodApprovedOn?: string;
}

// A working day someone stayed past the shift. minutes is what was approved, or what the punches show now.
export interface OvertimeClaim {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  minutes: number;
  decidedByName?: string;
  decidedOn?: string;
  decisionNote?: string;
  // Set while it waits for HR after the HOD approved.
  hodApprovedByName?: string;
  hodApprovedOn?: string;
}

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
  // Set while it waits for HR after the HOD approved.
  hodApprovedByName?: string;
  hodApprovedOn?: string;
}

export interface WorkSchedule {
  id: string;
  effectiveFrom: string;
  shiftStart: string;
  shiftEnd: string;
  graceMinutes: number;
  halfDayMinutes: number;
  reason: string;
  setBy: string;
  setByName?: string;
  setOn: string;
}

export interface CorrectionRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  kind: 'missed-in' | 'missed-out';
  category: FixCategory;
  requestedTime: string;
  // Only required for a late punch and for anything else.
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  raisedOn: string;
  decidedBy?: string;
  decidedOn?: string;
  decisionNote?: string;
  // Set while it waits for HR after the HOD approved.
  hodApprovedByName?: string;
  hodApprovedOn?: string;
}
