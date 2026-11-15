import { HttpClient, httpResource, HttpResourceRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AttendanceDay, CompOffClaim, CorrectionRequest, HomeDay } from '../../models/attendance';
import { Employee } from '../../models/employee';
import { LeaveBalance, LeaveRequest } from '../../models/leave';

export type DecisionStatus = 'pending' | 'approved' | 'rejected';

export interface Decision {
  decision: 'approved' | 'rejected';
  note?: string;
}

export interface TeamMember extends Employee {
  today?: AttendanceDay;
}

export interface TeamMemberDetail extends Employee {
  leaveBalances: LeaveBalance[];
}

// Read only views of other people: an HOD's reports, or everyone for a super admin. Same shapes either way.
export type ViewScope = 'team' | 'company';
// HR also reads every leave request, for one person's page.
export type RequestScope = ViewScope | 'hr';

interface ListOptions {
  status?: DecisionStatus;
  scope?: () => RequestScope;
  // Lets shared widgets skip the call entirely for people who aren't managers.
  isEnabled?: () => boolean;
}

const listRequest = (path: string, { status, isEnabled = () => true, scope = () => 'team' }: ListOptions) => (): HttpResourceRequest | undefined =>
  isEnabled() ? { url: `/api/${scope()}/${path}`, ...(status && { params: { status } }) } : undefined;

@Injectable({ providedIn: 'root' })
export class TeamApi {
  private readonly http = inject(HttpClient);

  members = ({ isEnabled = () => true, scope = () => 'team' }: { isEnabled?: () => boolean; scope?: () => ViewScope } = {}) =>
    httpResource<TeamMember[]>(() => (isEnabled() ? `/api/${scope()}` : undefined), { defaultValue: [] });
  member = (id: () => string, scope: () => ViewScope = () => 'team') => httpResource<TeamMemberDetail>(() => `/api/${scope()}/${encodeURIComponent(id())}`);
  attendance = (month: () => string, scope: () => ViewScope = () => 'team') =>
    httpResource<AttendanceDay[]>(() => ({ url: `/api/${scope()}/attendance`, params: { month: month() } }), { defaultValue: [] });

  leaveRequests = (options: ListOptions = {}) =>
    httpResource<LeaveRequest[]>(listRequest('leave-requests', options), { defaultValue: [] });
  corrections = (options: ListOptions = {}) =>
    httpResource<CorrectionRequest[]>(listRequest('corrections', options), { defaultValue: [] });
  homeDays = (options: ListOptions = {}) => httpResource<HomeDay[]>(listRequest('home-days', options), { defaultValue: [] });
  compOffs = (options: ListOptions = {}) => httpResource<CompOffClaim[]>(listRequest('comp-offs', options), { defaultValue: [] });

  // An HOD decides for their reports. A super admin can step in for anyone but themselves.
  decideLeave = (id: string, decision: Decision, scope: ViewScope = 'team') =>
    firstValueFrom(this.http.post<LeaveRequest>(`/api/${scope}/leave-requests/${encodeURIComponent(id)}/decision`, decision));
  decideCorrection = (id: string, decision: Decision, scope: ViewScope = 'team') =>
    firstValueFrom(this.http.post<CorrectionRequest>(`/api/${scope}/corrections/${encodeURIComponent(id)}/decision`, decision));
  decideCompOff = (id: string, decision: Decision, scope: ViewScope = 'team') =>
    firstValueFrom(this.http.post<CompOffClaim>(`/api/${scope}/comp-offs/${encodeURIComponent(id)}/decision`, decision));
  decideHomeDay = (id: string, decision: Decision, scope: ViewScope = 'team') =>
    firstValueFrom(this.http.post<HomeDay>(`/api/${scope}/home-days/${encodeURIComponent(id)}/decision`, decision));
}
