import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Appraisal,
  AppraisalCycle,
  CycleForm,
  Goal,
  GoalPlan,
  HrPerformance,
  MyPerformance,
  NewAppraisal,
  NewProbationReview,
  ProbationReview,
  SelfReview,
  TeamPerformance,
} from '../../models/performance';

const enc = encodeURIComponent;

export interface GoalsDecision {
  decision: 'approved' | 'rejected';
  note?: string;
}

// Where someone's goals stand, in words.
export const GOALS_STATUS: Record<CycleForm['goalsStatus'], string> = {
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
  team = () => httpResource<TeamPerformance>(() => '/api/team/performance');
  hrOverview = () => httpResource<HrPerformance>(() => '/api/hr/performance');

  accept = (id: string) => firstValueFrom(this.http.post<Appraisal>(`/api/performance/appraisals/${enc(id)}/accept`, {}));
  writeGoals = (goals: GoalPlan[]) => firstValueFrom(this.http.put<Goal[]>('/api/performance/goals', { goals }));
  submitGoals = () => firstValueFrom(this.http.post<CycleForm>('/api/performance/goals/submit', {}));
  writeSelfReview = (review: SelfReview) => firstValueFrom(this.http.put<CycleForm>('/api/performance/self-review', review));
  // The HOD's step, or HR's after it: approve, or send back with a note.
  decideGoals = (employeeId: string, decision: GoalsDecision, step: 'team' | 'hr') =>
    firstValueFrom(this.http.post<void>(`/api/${step === 'hr' ? 'hr' : 'team'}/performance/${enc(employeeId)}/goals/decision`, decision));
  appraise = (employeeId: string, appraisal: NewAppraisal) =>
    firstValueFrom(this.http.post<Appraisal>(`/api/team/performance/${enc(employeeId)}/appraisal`, appraisal));
  reviewProbation = (employeeId: string, review: NewProbationReview) =>
    firstValueFrom(this.http.post<ProbationReview>(`/api/team/performance/${enc(employeeId)}/probation-review`, review));
  openCycle = (cycle: { name: string; dueOn: string }) => firstValueFrom(this.http.post<AppraisalCycle>('/api/hr/appraisal-cycles', cycle));
  closeCycle = (id: string) => firstValueFrom(this.http.post<AppraisalCycle>(`/api/hr/appraisal-cycles/${enc(id)}/close`, {}));
}
