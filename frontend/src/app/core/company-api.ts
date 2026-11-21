import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppNotification, DocumentDates, DocumentEntry } from '../models/company';

@Injectable({ providedIn: 'root' })
export class CompanyApi {
  private readonly http = inject(HttpClient);

  notifications = () => httpResource<AppNotification[]>(() => '/api/notifications', { defaultValue: [] });
  documents = () => httpResource<DocumentEntry[]>(() => '/api/documents', { defaultValue: [] });
  // The file is the raw body. The expiry date rides along in the address, for types that expire.
  // One file at a time. The dates say which copy it belongs to: the same dates add a page, new ones make a new copy.
  uploadDocument = (type: string, file: File, dates: DocumentDates) =>
    firstValueFrom(this.http.put<DocumentEntry>(`/api/documents/${encodeURIComponent(type)}/file`, file, { params: { ...dates } }));
  removeDocumentFile = (type: string, fileId: string) =>
    firstValueFrom(this.http.delete<DocumentEntry>(`/api/documents/${encodeURIComponent(type)}/files/${encodeURIComponent(fileId)}`));
  markAllRead = () => firstValueFrom(this.http.post<void>('/api/notifications/read', {}));
}
