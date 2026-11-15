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
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
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
  pendingUsd: number;
  // How much one US dollar buys, set by HR.
  ratesPerUsd: Partial<Record<Currency, number>>;
  claims: FlightClaim[];
}

export type NewFlightClaim = Pick<FlightClaim, 'flightDate' | 'route' | 'amount' | 'currency'>;
