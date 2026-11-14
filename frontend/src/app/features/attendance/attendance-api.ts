import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AttendanceDay, CorrectionRequest } from '../../models/attendance';

export type CorrectionDraft = Pick<CorrectionRequest, 'date' | 'kind' | 'requestedTime' | 'reason'>;

@Injectable({ providedIn: 'root' })
export class AttendanceApi {
  private readonly http = inject(HttpClient);

  month = (month: () => string) =>
    httpResource<AttendanceDay[]>(() => ({ url: '/api/attendance', params: { month: month() } }), { defaultValue: [] });

  corrections = () => httpResource<CorrectionRequest[]>(() => '/api/attendance/corrections', { defaultValue: [] });

  raiseCorrection = (draft: CorrectionDraft) => firstValueFrom(this.http.post<CorrectionRequest>('/api/attendance/corrections', draft));
}
