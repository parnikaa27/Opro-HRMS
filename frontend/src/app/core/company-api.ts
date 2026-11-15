import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppNotification, Device, EmployeeDocument } from '../models/company';

@Injectable({ providedIn: 'root' })
export class CompanyApi {
  private readonly http = inject(HttpClient);

  notifications = () => httpResource<AppNotification[]>(() => '/api/notifications', { defaultValue: [] });
  devices = () => httpResource<Device[]>(() => '/api/devices', { defaultValue: [] });
  documents = () => httpResource<EmployeeDocument[]>(() => '/api/documents', { defaultValue: [] });
  markAllRead = () => firstValueFrom(this.http.post<void>('/api/notifications/read', {}));
}
