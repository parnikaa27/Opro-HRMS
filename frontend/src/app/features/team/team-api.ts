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

interface ListOptions {
  status?: DecisionStatus;
  // Lets shared widgets skip the call entirely for people who aren't managers.
  isEnabled?: () => boolean;
}

const listRequest = (url: string, { status, isEnabled = () => true }: ListOptions) => (): HttpResourceRequest | undefined =>
  isEnabled() ? { url, ...(status && { params: { status } }) } : undefined;

@Injectable({ providedIn: 'root' })
export class TeamApi {
  private readonly http = inject(HttpClient);

  members = () => httpResource<TeamMember[]>(() => '/api/team', { defaultValue: [] });
  member = (id: () => string) => httpResource<TeamMemberDetail>(() => `/api/team/${encodeURIComponent(id())}`);
  attendance = (month: () => string) =>
    httpResource<AttendanceDay[]>(() => ({ url: '/api/team/attendance', params: { month: month() } }), { defaultValue: [] });

  leaveRequests = (options: ListOptions = {}) =>
    httpResource<LeaveRequest[]>(listRequest('/api/team/leave-requests', options), { defaultValue: [] });
  corrections = (options: ListOptions = {}) =>
    httpResource<CorrectionRequest[]>(listRequest('/api/team/corrections', options), { defaultValue: [] });

  decideLeave = (id: string, decision: Decision) =>
    firstValueFrom(this.http.post<LeaveRequest>(`/api/team/leave-requests/${encodeURIComponent(id)}/decision`, decision));
  decideCorrection = (id: string, decision: Decision) =>
    firstValueFrom(this.http.post<CorrectionRequest>(`/api/team/corrections/${encodeURIComponent(id)}/decision`, decision));
}
