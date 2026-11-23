import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Session } from '../../core/session';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { formatFullDate, formatShortDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { CycleForm } from './forms/cycle-form';
import { PlanDecisionForm } from './forms/plan-decision-form';
import { Dialog } from '../../shared/ui/dialog';
import { HrPerformanceRow, Appraisal } from '../../models/performance';
import { OUTCOMES, PerformanceApi, PLAN_STATUS, RATINGS } from './performance-api';

// HR opens and closes appraisal cycles, follows how far the latest one has got, and sees every probation review.
@Component({
  selector: 'app-hr-performance-page',
  imports: [ConfirmButton, CycleForm, Dialog, ListSkeleton, PlanDecisionForm, RouterLink],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">PEOPLE &amp; CULTURE</span>
          <h1>Performance</h1>
          <p>People write a plan in five parts, their HOD approves it and then you. HODs appraise their own people; recommendations for promotions and increments land here for you to act on.</p>
        </div>
      </div>
      @if (overview.error()) {
        <p class="attendance-off">Performance didn't load. Refresh the page to try again.</p>
      } @else if (overview.isLoading() && !data()) {
        <app-list-skeleton [count]="4" />
      } @else {
        <section class="card card-pad" data-testid="cycle-card">
          <div class="card-heading">
            <div><span class="eyebrow">Appraisal cycle</span><h2>{{ cycle()?.name ?? 'None yet' }}</h2></div>
            @if (cycle() && !cycle()?.closedOn) {
              <app-confirm-button label="Close cycle" [question]="'Close ' + cycle()?.name + '? Appraisals not done stay undone.'" yes="Yes, close it" testId="close-cycle" (confirmed)="close()" />
            }
          </div>
          @if (cycle(); as current) {
            <p class="card-text" data-testid="cycle-progress">{{ done() }} of {{ rows().length }} appraised. {{ current.closedOn ? 'Closed on ' + formatFullDate(current.closedOn) : 'Due ' + formatFullDate(current.dueOn) }}.</p>
          }
          @if (!cycle() || cycle()?.closedOn) {
            <app-cycle-form (opened)="overview.reload()" />
          }
          @if (closeFailed()) {
            <p class="row-error" role="alert">That didn't close. Try again in a moment.</p>
          }
        </section>
        <section class="card all-requests" data-testid="plans-for-hr">
          <div class="card-heading"><div><span class="eyebrow">Plans</span><h2>Waiting for you</h2></div></div>
          @for (row of plansForHr(); track row.employeeId) {
            <div class="large-request plan-row" data-testid="plan-for-hr-row">
              <div><strong>{{ row.fullName }}</strong><span>{{ row.department }}</span></div>
              <div><small>HOD approved</small><strong>{{ row.form?.hodApprovedByName }}, {{ formatShortDate(row.form?.hodApprovedOn ?? '') }}</strong></div>
              <div class="request-actions labeled">
                <button type="button" class="approve" (click)="deciding.set(row)" data-testid="review-plan">Review plan</button>
              </div>
            </div>
          } @empty {
            <p class="attendance-off">No plans waiting for HR. They arrive here once an HOD approves one.</p>
          }
        </section>
        @if (rows().length) {
          <section class="card full-table">
            <div class="table-wrap">
              <table class="stacks">
                <thead><tr><th scope="col">Name</th><th scope="col">HOD</th><th scope="col">Plan</th><th scope="col">Rating</th><th scope="col">Recommends</th><th scope="col">Accepted</th></tr></thead>
                <tbody>
                  @for (row of rows(); track row.employeeId) {
                    <tr data-testid="hr-appraisal-row">
                      <td><a [routerLink]="['/hr/people', row.employeeId]" class="person-cell"><strong>{{ row.fullName }}</strong></a><small>{{ row.department }}</small></td>
                      <td data-label="HOD">{{ row.managerName }}</td>
                      <td data-label="Plan">{{ planStatus[row.form?.status ?? 'draft'] }}</td>
                      <td data-label="Rating">{{ row.appraisal ? row.appraisal.rating + ', ' + ratings[row.appraisal.rating] : 'Not yet' }}</td>
                      <td data-label="Recommends">{{ recommends(row.appraisal) }}</td>
                      <td data-label="Accepted">{{ acceptedOn(row.appraisal) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
        <section class="card all-requests" data-testid="probation-reviews">
          <div class="card-heading"><div><span class="eyebrow">Probation</span><h2>Reviews</h2></div></div>
          @for (review of data()?.probationReviews; track review.id) {
            <div class="large-request" data-testid="probation-review">
              <div><strong>{{ review.employeeName }}</strong><span>by {{ review.reviewedByName }}, {{ formatShortDate(review.reviewedOn) }}</span></div>
              <div><small>Outcome</small><strong>{{ outcomes[review.outcome] }}{{ review.extendedTo ? ' to ' + formatShortDate(review.extendedTo) : '' }}</strong></div>
              <div><small>Comments</small><strong>{{ review.comments }}</strong></div>
            </div>
          } @empty {
            <p class="attendance-off">No probation reviews yet. HODs review their people before probation ends.</p>
          }
        </section>
      }
    </div>

    <app-dialog heading="Their plan" [isOpen]="deciding() !== undefined" (isOpenChange)="$event || deciding.set(undefined)">
      @if (deciding(); as row) {
        <app-plan-decision-form [employeeId]="row.employeeId" [name]="row.fullName" [goals]="row.goals" [entries]="row.entries" step="hr" (decided)="decided()" />
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrPerformancePage {
  private readonly api = inject(PerformanceApi);
  private readonly session = inject(Session);
  protected readonly overview = this.api.hrOverview();
  protected readonly closeFailed = signal(false);
  protected readonly data = computed(() => valueOr(this.overview, undefined));
  protected readonly cycle = computed(() => this.data()?.cycles[0]);
  protected readonly rows = computed(() => this.data()?.people ?? []);
  protected readonly done = computed(() => this.rows().filter(({ appraisal }) => appraisal).length);
  protected readonly ratings = RATINGS;
  protected readonly outcomes = OUTCOMES;
  protected readonly formatFullDate = formatFullDate;
  protected readonly formatShortDate = formatShortDate;
  protected readonly planStatus = PLAN_STATUS;
  protected readonly deciding = signal<HrPerformanceRow | undefined>(undefined);
  // Plans their HOD approved, for HR's step. Never HR's own: another HR person approves those.
  protected readonly plansForHr = computed(() => this.rows().filter(({ form, employeeId }) => form?.status === 'hod-approved' && employeeId !== this.myId()));
  private readonly myId = computed(() => this.session.user()?.id);
  protected readonly acceptedOn = (appraisal?: Appraisal) => (appraisal?.acceptedOn ? formatShortDate(appraisal.acceptedOn) : 'Not yet');
  // Every cell says something, so a phone never shows a heading with nothing under it.
  protected readonly recommends = (appraisal?: Appraisal) =>
    !appraisal
      ? 'Not yet'
      : [appraisal.recommendsPromotion ? 'Promotion' : '', appraisal.incrementPercent ? `${appraisal.incrementPercent}% increment` : ''].filter(Boolean).join(', ') || 'None';

  protected decided() {
    this.deciding.set(undefined);
    this.overview.reload();
  }

  protected async close() {
    const cycle = this.cycle();
    if (!cycle) {
      return;
    }
    this.closeFailed.set(false);
    try {
      await this.api.closeCycle(cycle.id);
      this.overview.reload();
    } catch (error) {
      console.error('Closing a cycle failed', error);
      this.closeFailed.set(true);
    }
  }
}
