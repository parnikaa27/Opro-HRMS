export interface Holiday {
  id: string;
  date: string;
  name: string;
  isTentative: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedOn: string;
}

export interface CompanyEvent {
  id: string;
  date: string;
  name: string;
}

export interface ChangeRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  field: string;
  details: string;
  status: 'open' | 'done' | 'declined';
  raisedOn: string;
  decidedOn?: string;
  decisionNote?: string;
}

export interface Device {
  id: string;
  name: string;
  location: string;
  isOnline: boolean;
  lastSyncAt: string;
}

export interface EmployeeDocument {
  id: string;
  name: string;
  updatedOn?: string;
  expiresOn?: string;
  status: 'verified' | 'pending';
}

export interface AppNotification {
  id: string;
  kind: 'approval' | 'leave' | 'visa' | 'correction' | 'holiday' | 'announcement';
  text: string;
  createdOn: string;
  isRead: boolean;
}
