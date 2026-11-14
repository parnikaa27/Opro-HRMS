import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface ChangeRequest {
  field: string;
  details: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileApi {
  private readonly http = inject(HttpClient);

  requestChange = (request: ChangeRequest) => firstValueFrom(this.http.post<void>('/api/profile/change-requests', request));
}
