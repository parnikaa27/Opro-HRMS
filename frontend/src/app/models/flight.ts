export type Currency = 'USD' | 'MVR' | 'INR';

// A flight someone paid for and claims back. amountUsd is fixed at the rate on the day it was claimed.
export interface FlightClaim {
  id: string;
  employeeId: string;
  employeeName?: string;
  flightDate: string;
  route: string;
  amount: number;
  currency: Currency;
  amountUsd: number;
  hasReceipt: boolean;
  // Claims count as soon as they're made. Declined ones are from before that, when HR approved them.
  status: 'approved' | 'rejected' | 'cancelled';
  raisedOn: string;
  decidedByName?: string;
  decidedOn?: string;
  decisionNote?: string;
}

// One person's flight allowance for this year. allowanceUsd is missing for someone who doesn't get one.
export interface FlightYear {
  year: number;
  allowanceUsd?: number;
  usedUsd: number;
  // How much one US dollar buys, set by HR.
  ratesPerUsd: Partial<Record<Currency, number>>;
  claims: FlightClaim[];
}

export type NewFlightClaim = Pick<FlightClaim, 'flightDate' | 'route' | 'amount' | 'currency'>;
