import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Appraisal,
  AppraisalCycle,
  Goal,
  GoalPlan,
  HrPerformance,
  MyPerformance,
  NewAppraisal,
  NewProbationReview,
  ProbationReview,
  TeamPerformance,
} from '../../models/performance';

const enc = encodeURIComponent;

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

  acknowledge = (id: string) => firstValueFrom(this.http.post<Appraisal>(`/api/performance/appraisals/${enc(id)}/acknowledge`, {}));
  setGoals = (employeeId: string, goals: GoalPlan[]) => firstValueFrom(this.http.put<Goal[]>(`/api/team/performance/${enc(employeeId)}/goals`, { goals }));
  appraise = (employeeId: string, appraisal: NewAppraisal) =>
    firstValueFrom(this.http.post<Appraisal>(`/api/team/performance/${enc(employeeId)}/appraisal`, appraisal));
  reviewProbation = (employeeId: string, review: NewProbationReview) =>
    firstValueFrom(this.http.post<ProbationReview>(`/api/team/performance/${enc(employeeId)}/probation-review`, review));
  openCycle = (cycle: { name: string; dueOn: string }) => firstValueFrom(this.http.post<AppraisalCycle>('/api/hr/appraisal-cycles', cycle));
  closeCycle = (id: string) => firstValueFrom(this.http.post<AppraisalCycle>(`/api/hr/appraisal-cycles/${enc(id)}/close`, {}));
}
