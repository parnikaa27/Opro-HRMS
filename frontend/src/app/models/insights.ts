// The executive dashboard as Spring counts it (InsightController). The browser only shows these figures.

// A group with its count and its share of the whole, biggest first.
export interface Share {
  label: string;
  count: number;
  percent: number;
}

export interface PaperFigures {
  kind: 'visa' | 'passport' | 'approval' | 'medical' | 'insurance';
  label: string;
  expired: number;
  expiring: number;
}

// On is the day it falls this year: a birthday, a work anniversary, or when probation or a contract ends.
export interface PersonEvent {
  id: string;
  fullName: string;
  on: string;
  years?: number;
}

export interface Dashboard {
  today: string;
  workforce: { total: number; joiners: number; leavers: number; growthPercent: number; attritionPercent: number; retentionPercent: number };
  presence: { present: number; late: number; absent: number; onLeave: number; fromHome: number; atResort: number };
  month: { month: string; attendancePercent: number; lateCount: number; onTimePercent: number };
  mix: Record<'origin' | 'gender' | 'employmentType' | 'age' | 'department' | 'nationality', Share[]>;
  leave: { pending: number; annualUsedPercent: number; sickByMonth: { month: string; days: number }[] };
  compliance: { papers: PaperFigures[]; quotaUsed: number; quotaSlots: number; quotasFull: string[]; missingVisa: number };
  events: Record<'birthdays' | 'anniversaries' | 'probation' | 'contracts', PersonEvent[]>;
  performance: { cycleName?: string; onProbation: number; due: number; done: number; averageRating?: string; highPerformers: number; promotions: number };
}
