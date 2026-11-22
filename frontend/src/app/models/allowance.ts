export type AllowanceCurrency = 'MVR' | 'USD';

// A kind of allowance on HR's list, like housing. A retired one keeps its name in history.
export interface AllowanceType {
  code: string;
  name: string;
  retiredOn?: string;
}

// What someone gets every month of one kind, from a month on. endsOn is set once it stops.
export interface MonthlyAllowance {
  id: string;
  typeCode: string;
  typeName: string;
  amount: number;
  currency: AllowanceCurrency;
  startsOn: string;
  endsOn?: string;
  note?: string;
}

// A one-off amount an HOD grants a report, which HR approves or declines.
export interface AllowanceGrant {
  id: string;
  employeeId: string;
  employeeName?: string;
  typeCode: string;
  typeName: string;
  amount: number;
  currency: AllowanceCurrency;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  grantedByName?: string;
  grantedOn: string;
  decidedByName?: string;
  decidedOn?: string;
  decisionNote?: string;
}

export interface Allowances {
  monthly: MonthlyAllowance[];
  grants: AllowanceGrant[];
}
