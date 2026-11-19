import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AttendanceDay, WorkSchedule } from '../../models/attendance';
import {
  Announcement,
  ApprovalRules,
  ApprovalsWaiting,
  ChangeRequest,
  CompanyEvent,
  DocumentDates,
  DocumentEntry,
  DocumentsToCollect,
  DocumentType,
  Holiday,
} from '../../models/company';
import { Employee, EmployeeDetails, Visa } from '../../models/employee';
import { FlightYear } from '../../models/flight';
import { BalanceAdjustment, LeaveBalance, LeaveType } from '../../models/leave';
import { BankAccount, Education, EmployeeRecord, Experience, MedicalInsurance, Quota } from '../../models/record';

export interface HrEmployee extends Employee {
  today?: AttendanceDay;
}

export interface HrEmployeeDetail extends Employee {
  leaveBalances: LeaveBalance[];
  adjustments: BalanceAdjustment[];
}

export type NewAdjustment = Pick<BalanceAdjustment, 'employeeId' | 'type' | 'days' | 'reason'>;
export type NewSchedule = Omit<WorkSchedule, 'id' | 'setBy' | 'setByName' | 'setOn'>;

const enc = encodeURIComponent;

// The lists HR decides from, as the server names them in the decision URL.
export type ApprovalKind = 'leave' | 'corrections' | 'home-days' | 'comp-offs' | 'overtime';

export const NOTHING_WAITING: ApprovalsWaiting = { leave: [], corrections: [], homeDays: [], compOffs: [], overtime: [] };

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

  adjustBalance = (adjustment: NewAdjustment) => this.send<BalanceAdjustment>('POST', '/api/hr/balance-adjustments', adjustment);
  addEmployee = (details: EmployeeDetails) => this.send<Employee>('POST', '/api/hr/employees', details);
  updateEmployee = (id: string, details: EmployeeDetails) => this.send<Employee>('PUT', `/api/hr/employees/${enc(id)}`, details);
  markLeaving = (id: string, leaving: { lastDay: string; reason: string }) => this.send<Employee>('POST', `/api/hr/employees/${enc(id)}/leaving`, leaving);
  cancelLeaving = (id: string) => this.send<Employee>('DELETE', `/api/hr/employees/${enc(id)}/leaving`);
  // The browser has already cropped and re-encoded the photo to a small JPEG.
  savePhoto = (employeeId: string, photo: Blob) => this.send<Employee>('PUT', `/api/hr/employees/${enc(employeeId)}/photo`, photo);
  removePhoto = (employeeId: string) => this.send<void>('DELETE', `/api/hr/employees/${enc(employeeId)}/photo`);
  saveVisa = (employeeId: string, visa: Visa) => this.send<Visa>('PUT', `/api/hr/employees/${enc(employeeId)}/visa`, visa);
  saveLeaveType = ({ code, ...rules }: Partial<LeaveType>) =>
    code ? this.send<LeaveType>('PUT', `/api/hr/leave-types/${enc(code)}`, rules) : this.send<LeaveType>('POST', '/api/hr/leave-types', rules);
  // Deleted if nobody ever used it, otherwise retired with its history kept.
  removeLeaveType = (code: string) => this.send<void>('DELETE', `/api/hr/leave-types/${enc(code)}`);
  // One person's days of a type this year. Also how a type is given to just one person.
  setLeaveDays = (employeeId: string, type: string, change: { days: number; reason: string }) =>
    this.send<void>('PUT', `/api/hr/employees/${enc(employeeId)}/leave/${enc(type)}`, change);
  takeLeaveTypeAway = (employeeId: string, type: string, reason: string) =>
    this.send<void>('POST', `/api/hr/employees/${enc(employeeId)}/leave/${enc(type)}/remove`, { reason });

  employeeFlights = (id: () => string) => httpResource<FlightYear>(() => `/api/hr/employees/${enc(id())}/flights`);
  setFlightAllowance = (employeeId: string, year: number, amountUsd: number) =>
    this.send<void>('PUT', `/api/hr/employees/${enc(employeeId)}/flight-allowance`, { year, amountUsd });
  saveRates = (rates: { mvr: number; inr: number }) => this.send<Record<string, number>>('PUT', '/api/hr/exchange-rates', rates);

  saveSchedule = (schedule: NewSchedule) => this.send<WorkSchedule>('POST', '/api/hr/schedules', schedule);
  cancelSchedule = (id: string) => this.send<void>('DELETE', `/api/hr/schedules/${enc(id)}`);

  saveHoliday = ({ id, ...holiday }: Partial<Holiday>) =>
    id ? this.send<Holiday>('PUT', `/api/hr/holidays/${enc(id)}`, holiday) : this.send<Holiday>('POST', '/api/hr/holidays', holiday);
  deleteHoliday = (id: string) => this.send<void>('DELETE', `/api/hr/holidays/${enc(id)}`);
  startYear = (year: number) => this.send<Holiday[]>('POST', '/api/hr/holidays/start-year', { year });

  saveEvent = ({ id, ...event }: Partial<CompanyEvent>) =>
    id ? this.send<CompanyEvent>('PUT', `/api/hr/events/${enc(id)}`, event) : this.send<CompanyEvent>('POST', '/api/hr/events', event);
  deleteEvent = (id: string) => this.send<void>('DELETE', `/api/hr/events/${enc(id)}`);

  documentTypes = () => httpResource<DocumentType[]>(() => '/api/hr/document-types', { defaultValue: [] });
  saveDocumentType = ({ code, ...rules }: Omit<DocumentType, 'code' | 'retiredOn'> & { code?: string }) =>
    code ? this.send<DocumentType>('PUT', `/api/hr/document-types/${enc(code)}`, rules) : this.send<DocumentType>('POST', '/api/hr/document-types', rules);
  // Deleted if nobody ever uploaded one, otherwise retired with the copies kept.
  removeDocumentType = (code: string) => this.send<void>('DELETE', `/api/hr/document-types/${enc(code)}`);
  // What the HOD approved and HR approves too.
  approvals = ({ isEnabled = () => true }: { isEnabled?: () => boolean } = {}) =>
    httpResource<ApprovalsWaiting>(() => (isEnabled() ? '/api/hr/approvals' : undefined), { defaultValue: NOTHING_WAITING });
  decideApproval = (kind: ApprovalKind, id: string, decision: 'approved' | 'rejected', note?: string) =>
    this.send<void>('POST', `/api/hr/approvals/${kind}/${enc(id)}/decision`, { decision, ...(note && { note }) });
  approvalRules = () => httpResource<ApprovalRules>(() => '/api/hr/approval-rules');
  saveApprovalRules = (rules: ApprovalRules) => this.send<ApprovalRules>('PUT', '/api/hr/approval-rules', rules);
  waitingDocuments = ({ isEnabled = () => true }: { isEnabled?: () => boolean } = {}) =>
    httpResource<DocumentEntry[]>(() => (isEnabled() ? '/api/hr/documents' : undefined), { defaultValue: [] });
  employeeDocuments = (id: () => string) => httpResource<DocumentEntry[]>(() => `/api/hr/employees/${enc(id())}/documents`, { defaultValue: [] });
  documentsToCollect = () => httpResource<DocumentsToCollect[]>(() => '/api/hr/documents/to-collect', { defaultValue: [] });
  removeDocumentFileFor = (employeeId: string, type: string, fileId: string) =>
    this.send<DocumentEntry>('DELETE', `/api/hr/employees/${enc(employeeId)}/documents/${enc(type)}/files/${enc(fileId)}`);
  // Asks one person for a type that isn't for everyone, or stops asking.
  askForDocument = (employeeId: string, type: string) => this.send<void>('POST', `/api/hr/employees/${enc(employeeId)}/document-types/${enc(type)}`, {});
  stopAskingForDocument = (employeeId: string, type: string) => this.send<void>('DELETE', `/api/hr/employees/${enc(employeeId)}/document-types/${enc(type)}`);
  uploadDocumentFor = (employeeId: string, type: string, file: File, dates: DocumentDates) =>
    firstValueFrom(
      this.http.put<DocumentEntry>(`/api/hr/employees/${enc(employeeId)}/documents/${enc(type)}/file`, file, { params: { ...dates } }),
    );
  decideDocument = (employeeId: string, type: string, decision: 'verified' | 'rejected', note?: string) =>
    this.send<DocumentEntry>('POST', `/api/hr/employees/${enc(employeeId)}/documents/${enc(type)}/decision`, { decision, ...(note && { note }) });

  employeeRecord = (id: () => string) => httpResource<EmployeeRecord>(() => `/api/hr/employees/${enc(id())}/record`);
  saveInsurance = (employeeId: string, insurance: MedicalInsurance) => this.send<MedicalInsurance>('PUT', `/api/hr/employees/${enc(employeeId)}/insurance`, insurance);
  removeInsurance = (employeeId: string) => this.send<void>('DELETE', `/api/hr/employees/${enc(employeeId)}/insurance`);
  addEducation = (employeeId: string, entry: Omit<Education, 'id'>) => this.send<Education>('POST', `/api/hr/employees/${enc(employeeId)}/education`, entry);
  removeEducation = (employeeId: string, id: string) => this.send<void>('DELETE', `/api/hr/employees/${enc(employeeId)}/education/${enc(id)}`);
  addExperience = (employeeId: string, entry: Omit<Experience, 'id'>) => this.send<Experience>('POST', `/api/hr/employees/${enc(employeeId)}/experience`, entry);
  removeExperience = (employeeId: string, id: string) => this.send<void>('DELETE', `/api/hr/employees/${enc(employeeId)}/experience/${enc(id)}`);
  waitingBanks = ({ isEnabled = () => true }: { isEnabled?: () => boolean } = {}) =>
    httpResource<BankAccount[]>(() => (isEnabled() ? '/api/hr/bank-accounts' : undefined), { defaultValue: [] });
  decideBank = (employeeId: string, decision: 'verified' | 'rejected', note?: string) =>
    this.send<BankAccount>('POST', `/api/hr/employees/${enc(employeeId)}/bank-account/decision`, { decision, ...(note && { note }) });
  quotas = () => httpResource<Quota[]>(() => '/api/hr/quotas', { defaultValue: [] });
  saveQuota = ({ id, ...terms }: Omit<Quota, 'id' | 'used'> & { id?: string }) =>
    id ? this.send<Quota>('PUT', `/api/hr/quotas/${enc(id)}`, terms) : this.send<Quota>('POST', '/api/hr/quotas', terms);
  removeQuota = (id: string) => this.send<void>('DELETE', `/api/hr/quotas/${enc(id)}`);

  decideChange = (id: string, decision: 'done' | 'declined', note?: string) =>
    this.send<ChangeRequest>('POST', `/api/hr/change-requests/${enc(id)}/decision`, { decision, ...(note && { note }) });

  saveAnnouncement = ({ id, ...announcement }: Partial<Announcement>) =>
    id
      ? this.send<Announcement>('PUT', `/api/hr/announcements/${enc(id)}`, announcement)
      : this.send<Announcement>('POST', '/api/hr/announcements', announcement);
  deleteAnnouncement = (id: string) => this.send<void>('DELETE', `/api/hr/announcements/${enc(id)}`);
}
