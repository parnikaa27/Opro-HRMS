import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AttendanceDay, PunchEdit, WorkSchedule } from '../../models/attendance';
import { Announcement, ChangeRequest, CompanyEvent, Holiday } from '../../models/company';
import { Employee, EmployeeDetails, Visa } from '../../models/employee';
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
export type NewSchedule = Omit<WorkSchedule, 'id' | 'setBy' | 'setByName' | 'setOn'>;
export type NewPunchEdit = Pick<PunchEdit, 'employeeId' | 'date' | 'action' | 'time' | 'reason'>;

const enc = encodeURIComponent;

@Injectable({ providedIn: 'root' })
export class HrApi {
  private readonly http = inject(HttpClient);
  private readonly send = <T>(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: object) =>
    firstValueFrom(this.http.request<T>(method, url, { body }));

  employees = ({ isEnabled = () => true, includesFormer = () => false }: { isEnabled?: () => boolean; includesFormer?: () => boolean } = {}) =>
    httpResource<HrEmployee[]>(() => (isEnabled() ? { url: '/api/hr/employees', ...(includesFormer() && { params: { include: 'former' } }) } : undefined), { defaultValue: [] });
  employee = (id: () => string, { isEnabled = () => true }: { isEnabled?: () => boolean } = {}) =>
    httpResource<HrEmployeeDetail>(() => (isEnabled() ? `/api/hr/employees/${enc(id())}` : undefined));
  attendance = (employeeId: () => string, month: () => string) =>
    httpResource<AttendanceDay[]>(() => ({ url: '/api/hr/attendance', params: { employeeId: employeeId(), month: month() } }), { defaultValue: [] });
  changeRequests = ({ isEnabled = () => true }: { isEnabled?: () => boolean } = {}) =>
    httpResource<ChangeRequest[]>(() => (isEnabled() ? '/api/hr/change-requests' : undefined), { defaultValue: [] });
  announcements = () => httpResource<Announcement[]>(() => '/api/announcements', { defaultValue: [] });
  leaveTypes = () => httpResource<LeaveType[]>(() => '/api/leave/types', { defaultValue: [] });
  schedules = () => httpResource<WorkSchedule[]>(() => '/api/hr/schedules', { defaultValue: [] });
  punchEdits = (employeeId: () => string, month: () => string) =>
    httpResource<PunchEdit[]>(() => ({ url: '/api/hr/punch-edits', params: { employeeId: employeeId(), month: month() } }), { defaultValue: [] });

  recordLeave = (leave: RecordedLeave) => this.send<LeaveRequest>('POST', '/api/hr/leave-requests', leave);
  adjustBalance = (adjustment: NewAdjustment) => this.send<BalanceAdjustment>('POST', '/api/hr/balance-adjustments', adjustment);
  addEmployee = (details: EmployeeDetails) => this.send<Employee>('POST', '/api/hr/employees', details);
  updateEmployee = (id: string, details: EmployeeDetails) => this.send<Employee>('PUT', `/api/hr/employees/${enc(id)}`, details);
  markLeaving = (id: string, leaving: { lastDay: string; reason: string }) => this.send<Employee>('POST', `/api/hr/employees/${enc(id)}/leaving`, leaving);
  cancelLeaving = (id: string) => this.send<Employee>('DELETE', `/api/hr/employees/${enc(id)}/leaving`);
  // The browser has already cropped and re-encoded the photo to a small JPEG.
  savePhoto = (employeeId: string, photo: Blob) => this.send<Employee>('PUT', `/api/hr/employees/${enc(employeeId)}/photo`, photo);
  removePhoto = (employeeId: string) => this.send<void>('DELETE', `/api/hr/employees/${enc(employeeId)}/photo`);
  saveVisa = (employeeId: string, visa: Visa) => this.send<Visa>('PUT', `/api/hr/employees/${enc(employeeId)}/visa`, visa);
  updateLeaveType = (code: string, changes: Partial<LeaveType>) => this.send<LeaveType>('PUT', `/api/hr/leave-types/${enc(code)}`, changes);

  saveSchedule = (schedule: NewSchedule) => this.send<WorkSchedule>('POST', '/api/hr/schedules', schedule);
  cancelSchedule = (id: string) => this.send<void>('DELETE', `/api/hr/schedules/${enc(id)}`);
  editPunch = (edit: NewPunchEdit) => this.send<PunchEdit>('POST', '/api/hr/punch-edits', edit);

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
