import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ExitItem, Resignation } from '../../models/exit';

const enc = encodeURIComponent;

// Resigning, HR's step and the checklist. The HOD's step lives in TeamApi with the other team decisions.
@Injectable({ providedIn: 'root' })
export class ExitApi {
  private readonly http = inject(HttpClient);
  private readonly send = <T>(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: object) => firstValueFrom(this.http.request<T>(method, url, { body }));

  mine = () => httpResource<Resignation[]>(() => '/api/resignation', { defaultValue: [] });
  resign = (resignation: { reason: string; releaseOn: string }) => this.send<Resignation>('POST', '/api/resignation', resignation);
  withdraw = (id: string) => this.send<Resignation>('POST', `/api/resignation/${enc(id)}/withdraw`, {});

  waitingForHr = ({ isEnabled = () => true }: { isEnabled?: () => boolean } = {}) =>
    httpResource<Resignation[]>(() => (isEnabled() ? '/api/hr/resignations' : undefined), { defaultValue: [] });
  decideAsHr = (id: string, decision: { decision: 'approved' | 'rejected'; exitOn?: string; note?: string }) =>
    this.send<Resignation>('POST', `/api/hr/resignations/${enc(id)}/decision`, decision);
  // Empty (204) when they haven't resigned.
  exitOf = (employeeId: () => string) => httpResource<Resignation | null>(() => `/api/hr/employees/${enc(employeeId())}/exit`);
  tick = (employeeId: string, itemId: string, outcome: 'returned' | 'not-given') =>
    this.send<Resignation>('PUT', `/api/hr/employees/${enc(employeeId)}/exit/items/${enc(itemId)}`, { outcome });
  untick = (employeeId: string, itemId: string) => this.send<Resignation>('DELETE', `/api/hr/employees/${enc(employeeId)}/exit/items/${enc(itemId)}`);

  items = () => httpResource<ExitItem[]>(() => '/api/hr/exit-items', { defaultValue: [] });
  addItem = (name: string) => this.send<ExitItem>('POST', '/api/hr/exit-items', { name });
  removeItem = (id: string) => this.send<void>('DELETE', `/api/hr/exit-items/${enc(id)}`);
}
