import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AttendanceDay, CorrectionRequest, WorkMode } from '../../models/attendance';
import { Location } from '../../shared/utils/location';

export type CorrectionDraft = Pick<CorrectionRequest, 'date' | 'kind' | 'category' | 'requestedTime' | 'reason'>;

@Injectable({ providedIn: 'root' })
export class AttendanceApi {
  private readonly http = inject(HttpClient);

  month = (month: () => string) =>
    httpResource<AttendanceDay[]>(() => ({ url: '/api/attendance', params: { month: month() } }), { defaultValue: [] });

  corrections = () => httpResource<CorrectionRequest[]>(() => '/api/attendance/corrections', { defaultValue: [] });

  raiseCorrection = (draft: CorrectionDraft) => firstValueFrom(this.http.post<CorrectionRequest>('/api/attendance/corrections', draft));

  // The server checks an office punch is near an office. It sends back today as it now stands.
  punch = (mode: WorkMode, location?: Location) => firstValueFrom(this.http.post<AttendanceDay>('/api/attendance/punch', { mode, ...location }));
}
