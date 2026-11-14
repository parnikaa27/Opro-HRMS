export interface Holiday {
  date: string;
  name: string;
  isTentative: boolean;
}

export interface CompanyEvent {
  id: string;
  date: string;
  name: string;
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
  kind: 'approval' | 'leave' | 'visa' | 'correction';
  text: string;
  createdOn: string;
  isRead: boolean;
}
