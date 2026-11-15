import { HttpClient, httpResource, HttpResourceRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AttendanceDay, CorrectionRequest } from '../../models/attendance';
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

export type RequestScope = 'team' | 'hr';

interface ListOptions {
  status?: DecisionStatus;
  // Managers see their reports, HR sees everyone. Same shapes either way.
  scope?: () => RequestScope;
  // Lets shared widgets skip the call entirely for people who aren't managers.
  isEnabled?: () => boolean;
}

const listRequest = (path: string, { status, isEnabled = () => true, scope = () => 'team' }: ListOptions) => (): HttpResourceRequest | undefined =>
  isEnabled() ? { url: `/api/${scope()}/${path}`, ...(status && { params: { status } }) } : undefined;

@Injectable({ providedIn: 'root' })
export class TeamApi {
  private readonly http = inject(HttpClient);

  members = ({ isEnabled = () => true }: Pick<ListOptions, 'isEnabled'> = {}) =>
    httpResource<TeamMember[]>(() => (isEnabled() ? '/api/team' : undefined), { defaultValue: [] });
  member = (id: () => string) => httpResource<TeamMemberDetail>(() => `/api/team/${encodeURIComponent(id())}`);
  attendance = (month: () => string) =>
    httpResource<AttendanceDay[]>(() => ({ url: '/api/team/attendance', params: { month: month() } }), { defaultValue: [] });

  leaveRequests = (options: ListOptions = {}) =>
    httpResource<LeaveRequest[]>(listRequest('leave-requests', options), { defaultValue: [] });
  corrections = (options: ListOptions = {}) =>
    httpResource<CorrectionRequest[]>(listRequest('corrections', options), { defaultValue: [] });

  decideLeave = (id: string, decision: Decision, scope: RequestScope = 'team') =>
    firstValueFrom(this.http.post<LeaveRequest>(`/api/${scope}/leave-requests/${encodeURIComponent(id)}/decision`, decision));
  decideCorrection = (id: string, decision: Decision, scope: RequestScope = 'team') =>
    firstValueFrom(this.http.post<CorrectionRequest>(`/api/${scope}/corrections/${encodeURIComponent(id)}/decision`, decision));
}
