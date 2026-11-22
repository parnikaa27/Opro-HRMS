import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Appraisal,
  AppraisalCycle,
  CycleForm,
  EntryPlan,
  Goal,
  GoalPlan,
  HrPerformance,
  MyPerformance,
  NewAppraisal,
  NewProbationReview,
  PlanEntry,
  PlanSection,
  PlanStatus,
  ProbationReview,
  TeamPerformance,
} from '../../models/performance';

const enc = encodeURIComponent;

// team for an HOD, company for a super admin standing in for one.
export type PerformanceScope = 'team' | 'company';

export interface PlanDecision {
  decision: 'approved' | 'rejected';
  note?: string;
}

// Where someone's plan stands, in words.
export const PLAN_STATUS: Record<PlanStatus, string> = {
  draft: 'Not sent yet',
  submitted: 'Waiting for the HOD',
  'hod-approved': 'Waiting for HR',
  approved: 'Approved',
  rejected: 'Sent back',
};

// The 1 to 5 scale, in words.
export const RATINGS: Record<number, string> = {
  1: 'Needs improvement',
  2: 'Below expectations',
  3: 'Meets expectations',
  4: 'Exceeds expectations',
  5: 'Outstanding',
};

export const OUTCOMES = { confirmed: 'Confirmed', extended: 'Extended', 'not-confirmed': 'Not confirmed' } as const;

@Injectable({ providedIn: 'root' })
export class PerformanceApi {
  private readonly http = inject(HttpClient);

  mine = () => httpResource<MyPerformance>(() => '/api/performance');
  team = (scope: () => PerformanceScope) => httpResource<TeamPerformance>(() => `/api/${scope()}/performance`);
  hrOverview = () => httpResource<HrPerformance>(() => '/api/hr/performance');

  accept = (id: string) => firstValueFrom(this.http.post<Appraisal>(`/api/performance/appraisals/${enc(id)}/accept`, {}));
  writeGoals = (goals: GoalPlan[]) => firstValueFrom(this.http.put<Goal[]>('/api/performance/goals', { goals }));
  writeSection = (section: PlanSection, entries: EntryPlan[]) =>
    firstValueFrom(this.http.put<PlanEntry[]>(`/api/performance/sections/${enc(section)}`, { entries }));
  submit = () => firstValueFrom(this.http.post<CycleForm>('/api/performance/submit', {}));
  // The HOD's step (or a super admin's for them), or HR's after it: approve, or send back with a note.
  decide = (employeeId: string, decision: PlanDecision, step: PerformanceScope | 'hr') =>
    firstValueFrom(this.http.post<void>(`/api/${step}/performance/${enc(employeeId)}/decision`, decision));
  appraise = (employeeId: string, appraisal: NewAppraisal, scope: PerformanceScope) =>
    firstValueFrom(this.http.post<Appraisal>(`/api/${scope}/performance/${enc(employeeId)}/appraisal`, appraisal));
  reviewProbation = (employeeId: string, review: NewProbationReview, scope: PerformanceScope) =>
    firstValueFrom(this.http.post<ProbationReview>(`/api/${scope}/performance/${enc(employeeId)}/probation-review`, review));
  openCycle = (cycle: { name: string; dueOn: string }) => firstValueFrom(this.http.post<AppraisalCycle>('/api/hr/appraisal-cycles', cycle));
  closeCycle = (id: string) => firstValueFrom(this.http.post<AppraisalCycle>(`/api/hr/appraisal-cycles/${enc(id)}/close`, {}));
}
