import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AllowanceCurrency, AllowanceGrant, Allowances, AllowanceType, MonthlyAllowance } from '../../models/allowance';
import { formatMonth, monthOf } from '../../shared/utils/date-time';

const enc = encodeURIComponent;
const NONE: Allowances = { monthly: [], grants: [] };
const moneyFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });

// "MVR 6,000"
export const money = (amount: number, currency: AllowanceCurrency) => `${currency} ${moneyFormat.format(amount)}`;

// "MVR 6,000 a month since January 2024", or "… until …" once it has stopped.
export const describeMonthly = ({ amount, currency, startsOn, endsOn }: MonthlyAllowance, today: string) => {
  const span = startsOn > today ? `from ${formatMonth(monthOf(startsOn))}` : `since ${formatMonth(monthOf(startsOn))}`;
  return `${money(amount, currency)} a month ${span}${endsOn ? `, until ${formatMonth(monthOf(endsOn))}` : ''}`;
};

export const GRANT_STATUS = { pending: 'Waiting for HR', approved: 'Approved', rejected: 'Declined' } as const;

export interface NewGrant {
  employeeId: string;
  type: string;
  amount: number;
  currency: AllowanceCurrency;
  reason: string;
}

@Injectable({ providedIn: 'root' })
export class AllowanceApi {
  private readonly http = inject(HttpClient);
  private readonly send = <T>(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: object) => firstValueFrom(this.http.request<T>(method, url, { body }));

  mine = () => httpResource<Allowances>(() => '/api/allowances', { defaultValue: NONE });
  types = () => httpResource<AllowanceType[]>(() => '/api/allowance-types', { defaultValue: [] });
  teamGrants = () => httpResource<AllowanceGrant[]>(() => '/api/team/allowance-grants', { defaultValue: [] });
  grant = (grant: NewGrant) => this.send<AllowanceGrant>('POST', '/api/team/allowance-grants', grant);

  of = (employeeId: () => string) => httpResource<Allowances>(() => `/api/hr/employees/${enc(employeeId())}/allowances`, { defaultValue: NONE });
  setMonthly = (employeeId: string, type: string, change: { amount: number; currency: AllowanceCurrency; startsOn: string; note?: string }) =>
    this.send<MonthlyAllowance>('PUT', `/api/hr/employees/${enc(employeeId)}/allowances/${enc(type)}`, change);
  stopMonthly = (employeeId: string, type: string, lastMonth: string) =>
    this.send<MonthlyAllowance>('POST', `/api/hr/employees/${enc(employeeId)}/allowances/${enc(type)}/stop`, { lastMonth });
  waitingForHr = ({ isEnabled = () => true }: { isEnabled?: () => boolean } = {}) =>
    httpResource<AllowanceGrant[]>(() => (isEnabled() ? '/api/hr/allowance-grants' : undefined), { defaultValue: [] });
  decide = (id: string, decision: { decision: 'approved' | 'rejected'; note?: string }) =>
    this.send<AllowanceGrant>('POST', `/api/hr/allowance-grants/${enc(id)}/decision`, decision);
  addType = (name: string) => this.send<AllowanceType>('POST', '/api/hr/allowance-types', { name });
  removeType = (code: string) => this.send<void>('DELETE', `/api/hr/allowance-types/${enc(code)}`);
}
