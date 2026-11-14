import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LeaveBalance, LeaveRequest, LeaveType } from '../../models/leave';

export type LeaveApplication = Pick<LeaveRequest, 'type' | 'from' | 'to' | 'halfDay' | 'days' | 'reason'>;

@Injectable({ providedIn: 'root' })
export class LeaveApi {
  private readonly http = inject(HttpClient);

  types = () => httpResource<LeaveType[]>(() => '/api/leave/types', { defaultValue: [] });
  balances = () => httpResource<LeaveBalance[]>(() => '/api/leave/balances', { defaultValue: [] });
  requests = () => httpResource<LeaveRequest[]>(() => '/api/leave/requests', { defaultValue: [] });

  apply = (application: LeaveApplication) => firstValueFrom(this.http.post<LeaveRequest>('/api/leave/requests', application));
  cancel = (id: string) => firstValueFrom(this.http.post<LeaveRequest>(`/api/leave/requests/${encodeURIComponent(id)}/cancel`, {}));
}
