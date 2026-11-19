import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TeamMemberPerformance } from '../../models/performance';
import { Avatar } from '../../shared/ui/avatar';
import { Dialog } from '../../shared/ui/dialog';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { formatFullDate, formatShortDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { AppraisalForm } from './forms/appraisal-form';
import { GoalsDecisionForm } from './forms/goals-decision-form';
import { ProbationReviewForm } from './forms/probation-review-form';
import { GOALS_STATUS, PerformanceApi, RATINGS } from './performance-api';

type Open = { kind: 'goals' | 'appraise' | 'probation'; person: TeamMemberPerformance } | undefined;

// What a row's goals column says: how many, and where they stand.
const goalsLine = ({ goals, form }: TeamMemberPerformance) =>
  goals.length ? `${plural(goals.length, 'goal')}, ${GOALS_STATUS[form?.goalsStatus ?? 'draft'].toLowerCase()}` : 'Not written yet';

// The HOD's view: probation reviews coming up, and the team's goals to approve and appraisals in the open cycle.
@Component({
  selector: 'app-team-performance-page',
  imports: [AppraisalForm, Avatar, Dialog, GoalsDecisionForm, ListSkeleton, ProbationReviewForm, StatusPill],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">TEAM MANAGEMENT</span>
          <h1>Performance</h1>
          <p>{{ intro() }}</p>
        </div>
      </div>
      @if (team.error()) {
        <p class="attendance-off">Your team's performance didn't load. Refresh the page to try again.</p>
      } @else if (team.isLoading() && people().length === 0) {
        <app-list-skeleton [count]="4" />
      } @else {
        @if (onProbation().length) {
          <section class="card all-requests" data-testid="probation-card">
            <div class="card-heading"><div><span class="eyebrow">PROBATION</span><h2>Reviews to do</h2></div></div>
            @for (person of onProbation(); track person.employeeId) {
              <div class="large-request" data-testid="probation-row">
                <app-avatar [name]="person.fullName" />
                <div><strong>{{ person.fullName }}</strong><span>{{ person.designation }}</span></div>
                <div><small>PROBATION ENDS</small><strong>{{ formatFullDate(person.probationEndsOn ?? '') }}</strong></div>
                <div class="request-actions labeled">
                  <button type="button" class="approve" (click)="open.set({ kind: 'probation', person })" data-testid="review-probation">Review</button>
                </div>
              </div>
            }
          </section>
        }
        <section class="card all-requests" data-testid="appraisals-card">
          <div class="card-heading"><div><span class="eyebrow">APPRAISALS</span><h2>{{ cycle()?.name ?? 'No cycle open' }}</h2></div></div>
          @for (person of people(); track person.employeeId) {
            <div class="large-request" data-testid="team-appraisal-row">
              <app-avatar [name]="person.fullName" />
              <div><strong>{{ person.fullName }}</strong><span>{{ person.designation }}</span></div>
              <div><small>GOALS</small><strong>{{ goalsLine(person) }}</strong></div>
              <div><small>RATING</small><strong>{{ person.appraisal ? person.appraisal.rating + ', ' + ratings[person.appraisal.rating] : 'Not yet' }}</strong></div>
              @if (person.appraisal; as appraisal) {
                <app-status-pill [tone]="appraisal.acceptedOn ? 'ok' : 'late'">{{ appraisal.acceptedOn ? 'Accepted ' + formatShortDate(appraisal.acceptedOn) : 'Not accepted yet' }}</app-status-pill>
              } @else if (person.form?.goalsStatus === 'submitted') {
                <div class="request-actions labeled">
                  <button type="button" class="approve" (click)="open.set({ kind: 'goals', person })" data-testid="review-goals">Review goals</button>
                </div>
              } @else if (person.form?.goalsStatus === 'approved') {
                <div class="request-actions labeled">
                  <button type="button" class="approve" (click)="open.set({ kind: 'appraise', person })" data-testid="appraise">Appraise</button>
                </div>
              } @else {
                <span class="card-note">{{ person.form?.goalsStatus === 'hod-approved' ? 'With HR' : 'Waiting for their goals' }}</span>
              }
            </div>
          }
        </section>
      }
    </div>

    <app-dialog [heading]="dialogHeading()" [isOpen]="open() !== undefined" (isOpenChange)="$event || open.set(undefined)">
      @if (open(); as opened) {
        @switch (opened.kind) {
          @case ('goals') {
            <app-goals-decision-form [employeeId]="opened.person.employeeId" [name]="opened.person.fullName" [goals]="opened.person.goals" (decided)="saved()" />
          }
          @case ('appraise') {
            <app-appraisal-form [employeeId]="opened.person.employeeId" [name]="opened.person.fullName" [goals]="opened.person.goals" [selfReview]="opened.person.form" (saved)="saved()" (cancelled)="open.set(undefined)" />
          }
          @case ('probation') {
            <app-probation-review-form [employeeId]="opened.person.employeeId" [name]="opened.person.fullName" [endsOn]="opened.person.probationEndsOn ?? ''" (saved)="saved()" (cancelled)="open.set(undefined)" />
          }
        }
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamPerformancePage {
  protected readonly team = inject(PerformanceApi).team();
  protected readonly open = signal<Open>(undefined);
  protected readonly cycle = computed(() => valueOr(this.team, undefined)?.cycle);
  protected readonly people = computed(() => valueOr(this.team, undefined)?.people ?? []);
  protected readonly onProbation = computed(() =>
    this.people()
      .filter(({ probationEndsOn }) => probationEndsOn !== undefined)
      .sort((first, second) => (first.probationEndsOn ?? '').localeCompare(second.probationEndsOn ?? '')),
  );
  protected readonly intro = computed(() => {
    const cycle = this.cycle();
    return cycle
      ? `${cycle.name} is open until ${formatFullDate(cycle.dueOn)}. Each person writes their goals for you, then HR, to approve. Then appraise them.`
      : 'No appraisal cycle is open. HR opens one each year, and you’ll be told when they do.';
  });
  protected readonly dialogHeading = computed(() => ({ goals: 'Their goals', appraise: 'Appraise', probation: 'Probation review' })[this.open()?.kind ?? 'goals']);
  protected readonly goalsLine = goalsLine;
  protected readonly ratings = RATINGS;
  protected readonly formatFullDate = formatFullDate;
  protected readonly formatShortDate = formatShortDate;

  protected saved() {
    this.open.set(undefined);
    this.team.reload();
  }
}
