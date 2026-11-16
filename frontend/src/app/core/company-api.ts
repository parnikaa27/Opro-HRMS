import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppNotification, DocumentEntry } from '../models/company';

@Injectable({ providedIn: 'root' })
export class CompanyApi {
  private readonly http = inject(HttpClient);

  notifications = () => httpResource<AppNotification[]>(() => '/api/notifications', { defaultValue: [] });
  documents = () => httpResource<DocumentEntry[]>(() => '/api/documents', { defaultValue: [] });
  // The file is the raw body. The expiry date rides along in the address, for types that expire.
  uploadDocument = (type: string, file: File, expiresOn?: string) =>
    firstValueFrom(this.http.put<DocumentEntry>(`/api/documents/${encodeURIComponent(type)}/file`, file, { params: expiresOn ? { expiresOn } : {} }));
  markAllRead = () => firstValueFrom(this.http.post<void>('/api/notifications/read', {}));
}
