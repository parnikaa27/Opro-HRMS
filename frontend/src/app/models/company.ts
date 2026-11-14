export interface Holiday {
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

export interface AppNotification {
  id: string;
  kind: 'approval' | 'leave' | 'visa' | 'correction';
  text: string;
  createdOn: string;
  isRead: boolean;
}
