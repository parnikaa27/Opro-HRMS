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

// A document on HR's list, and whether employees or HR upload it.
export interface DocumentType {
  code: string;
  name: string;
  uploadedBy: 'employee' | 'hr';
  hasExpiry: boolean;
  isForExpatriatesOnly: boolean;
  retiredOn?: string;
}

// One type someone needs, and their copy if they have one. status is missing until there's a copy,
// and expired once a verified one runs out.
export interface DocumentEntry {
  type: string;
  name: string;
  uploadedBy: DocumentType['uploadedBy'];
  hasExpiry: boolean;
  status: 'missing' | 'pending' | 'verified' | 'rejected' | 'expired';
  updatedOn?: string;
  expiresOn?: string;
  decisionNote?: string;
  hasFile: boolean;
  employeeId?: string;
  employeeName?: string;
}

export interface AppNotification {
  id: string;
  kind: 'approval' | 'leave' | 'visa' | 'correction' | 'holiday' | 'announcement' | 'record' | 'schedule' | 'home' | 'flight';
  text: string;
  createdOn: string;
  isRead: boolean;
}
