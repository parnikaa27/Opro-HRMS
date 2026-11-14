import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AttendanceDay } from '../../models/attendance';
import { Announcement, ChangeRequest, CompanyEvent, Holiday } from '../../models/company';
import { Employee, Visa } from '../../models/employee';
import { BalanceAdjustment, LeaveBalance, LeaveRequest, LeaveType } from '../../models/leave';

export interface HrEmployee extends Employee {
  today?: AttendanceDay;
}

export interface HrEmployeeDetail extends Employee {
  leaveBalances: LeaveBalance[];
  adjustments: BalanceAdjustment[];
}

export type RecordedLeave = Pick<LeaveRequest, 'employeeId' | 'type' | 'from' | 'to' | 'halfDay' | 'days' | 'reason'>;
export type NewAdjustment = Pick<BalanceAdjustment, 'employeeId' | 'type' | 'days' | 'reason'>;

const enc = encodeURIComponent;

@Injectable({ providedIn: 'root' })
export class HrApi {
  private readonly http = inject(HttpClient);
  private readonly send = <T>(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: object) =>
    firstValueFrom(this.http.request<T>(method, url, { body }));

  employees = ({ isEnabled = () => true }: { isEnabled?: () => boolean } = {}) =>
    httpResource<HrEmployee[]>(() => (isEnabled() ? '/api/hr/employees' : undefined), { defaultValue: [] });
  employee = (id: () => string) => httpResource<HrEmployeeDetail>(() => `/api/hr/employees/${enc(id())}`);
  attendance = (employeeId: () => string, month: () => string) =>
    httpResource<AttendanceDay[]>(() => ({ url: '/api/hr/attendance', params: { employeeId: employeeId(), month: month() } }), { defaultValue: [] });
  changeRequests = ({ isEnabled = () => true }: { isEnabled?: () => boolean } = {}) =>
    httpResource<ChangeRequest[]>(() => (isEnabled() ? '/api/hr/change-requests' : undefined), { defaultValue: [] });
  announcements = () => httpResource<Announcement[]>(() => '/api/announcements', { defaultValue: [] });
  leaveTypes = () => httpResource<LeaveType[]>(() => '/api/leave/types', { defaultValue: [] });

  recordLeave = (leave: RecordedLeave) => this.send<LeaveRequest>('POST', '/api/hr/leave-requests', leave);
  adjustBalance = (adjustment: NewAdjustment) => this.send<BalanceAdjustment>('POST', '/api/hr/balance-adjustments', adjustment);
  saveVisa = (employeeId: string, visa: Visa) => this.send<Visa>('PUT', `/api/hr/employees/${enc(employeeId)}/visa`, visa);
  updateLeaveType = (code: string, changes: Partial<LeaveType>) => this.send<LeaveType>('PUT', `/api/hr/leave-types/${enc(code)}`, changes);

  saveHoliday = ({ id, ...holiday }: Partial<Holiday>) =>
    id ? this.send<Holiday>('PUT', `/api/hr/holidays/${enc(id)}`, holiday) : this.send<Holiday>('POST', '/api/hr/holidays', holiday);
  deleteHoliday = (id: string) => this.send<void>('DELETE', `/api/hr/holidays/${enc(id)}`);
  startYear = (year: number) => this.send<Holiday[]>('POST', '/api/hr/holidays/start-year', { year });

  saveEvent = ({ id, ...event }: Partial<CompanyEvent>) =>
    id ? this.send<CompanyEvent>('PUT', `/api/hr/events/${enc(id)}`, event) : this.send<CompanyEvent>('POST', '/api/hr/events', event);
  deleteEvent = (id: string) => this.send<void>('DELETE', `/api/hr/events/${enc(id)}`);

  decideChange = (id: string, decision: 'done' | 'declined', note?: string) =>
    this.send<ChangeRequest>('POST', `/api/hr/change-requests/${enc(id)}/decision`, { decision, ...(note && { note }) });

  saveAnnouncement = ({ id, ...announcement }: Partial<Announcement>) =>
    id
      ? this.send<Announcement>('PUT', `/api/hr/announcements/${enc(id)}`, announcement)
      : this.send<Announcement>('POST', '/api/hr/announcements', announcement);
  deleteAnnouncement = (id: string) => this.send<void>('DELETE', `/api/hr/announcements/${enc(id)}`);
}
