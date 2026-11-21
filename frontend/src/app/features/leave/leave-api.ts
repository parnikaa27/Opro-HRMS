import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LeaveBalance, LeaveRequest, LeaveType } from '../../models/leave';

export type LeaveApplication = Pick<
  LeaveRequest,
  'type' | 'from' | 'to' | 'halfDay' | 'days' | 'reason' | 'kind' | 'relatedRequestId' | 'usesFlightEntitlement' | 'wantsSalaryAdvance'
>;

const CERTIFICATE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_CERTIFICATE_BYTES = 5_242_880; // 5 MB
export const CERTIFICATE_ACCEPT = CERTIFICATE_TYPES.join(',');

// Checked again on the server, by the file's first bytes. This just saves a wasted upload.
export const certificateProblem = (file: File) =>
  CERTIFICATE_TYPES.includes(file.type) && file.size <= MAX_CERTIFICATE_BYTES ? undefined : 'Attach a PDF, JPG or PNG under 5 MB.';

// Sick leave beyond the policy's limit needs a certificate.
export const needsCertificate = (type: LeaveType | undefined, days: number) => type?.documentRequiredAfterDays !== undefined && days > type.documentRequiredAfterDays;

@Injectable({ providedIn: 'root' })
export class LeaveApi {
  private readonly http = inject(HttpClient);

  types = () => httpResource<LeaveType[]>(() => '/api/leave/types', { defaultValue: [] });
  balances = () => httpResource<LeaveBalance[]>(() => '/api/leave/balances', { defaultValue: [] });
  requests = () => httpResource<LeaveRequest[]>(() => '/api/leave/requests', { defaultValue: [] });

  apply = (application: LeaveApplication) => firstValueFrom(this.http.post<LeaveRequest>('/api/leave/requests', application));
  attachCertificate = (id: string, file: File) =>
    firstValueFrom(this.http.put<LeaveRequest>(`/api/leave/requests/${encodeURIComponent(id)}/certificate`, file));
  cancel = (id: string) => firstValueFrom(this.http.post<LeaveRequest>(`/api/leave/requests/${encodeURIComponent(id)}/cancel`, {}));
}
