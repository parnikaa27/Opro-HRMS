import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Announcement, AppNotification } from '../models/company';

@Injectable({ providedIn: 'root' })
export class CompanyApi {
  private readonly http = inject(HttpClient);

  announcements = () => httpResource<Announcement[]>(() => '/api/announcements', { defaultValue: [] });
  notifications = () => httpResource<AppNotification[]>(() => '/api/notifications', { defaultValue: [] });
  markAllRead = () => firstValueFrom(this.http.post<void>('/api/notifications/read', {}));
}
