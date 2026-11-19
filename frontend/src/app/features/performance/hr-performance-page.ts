import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { formatFullDate, formatShortDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { CycleForm } from './forms/cycle-form';
import { OUTCOMES, PerformanceApi, RATINGS } from './performance-api';

// HR opens and closes appraisal cycles, follows how far the latest one has got, and sees every probation review.
@Component({
  selector: 'app-hr-performance-page',
  imports: [ConfirmButton, CycleForm, ListSkeleton, RouterLink],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">PEOPLE &amp; CULTURE</span>
          <h1>Performance</h1>
          <p>HODs set goals and appraise their own people. Recommendations for promotions and increments land here for you to act on.</p>
        </div>
      </div>
      @if (overview.error()) {
        <p class="attendance-off">Performance didn't load. Refresh the page to try again.</p>
      } @else if (overview.isLoading() && !data()) {
        <app-list-skeleton [count]="4" />
      } @else {
        <section class="card card-pad" data-testid="cycle-card">
          <div class="card-heading">
            <div><span class="eyebrow">APPRAISAL CYCLE</span><h2>{{ cycle()?.name ?? 'None yet' }}</h2></div>
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
        @if (rows().length) {
          <section class="card full-table">
            <div class="table-wrap">
              <table class="stacks">
                <thead><tr><th scope="col">NAME</th><th scope="col">HOD</th><th scope="col">GOALS</th><th scope="col">RATING</th><th scope="col">RECOMMENDS</th><th scope="col">READ</th></tr></thead>
                <tbody>
                  @for (row of rows(); track row.employeeId) {
                    <tr data-testid="hr-appraisal-row">
                      <td><a [routerLink]="['/hr/people', row.employeeId]" class="person-cell"><strong>{{ row.fullName }}</strong></a><small>{{ row.department }}</small></td>
                      <td data-label="HOD">{{ row.managerName }}</td>
                      <td data-label="GOALS">{{ row.goalCount || 'None' }}</td>
                      <td data-label="RATING">{{ row.appraisal ? row.appraisal.rating + ', ' + ratings[row.appraisal.rating] : 'Not yet' }}</td>
                      <td data-label="RECOMMENDS">{{ recommends(row.appraisal?.recommendsPromotion, row.appraisal?.incrementPercent) }}</td>
                      <td data-label="READ">{{ readOn(row.appraisal?.acknowledgedOn) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
        <section class="card all-requests" data-testid="probation-reviews">
          <div class="card-heading"><div><span class="eyebrow">PROBATION</span><h2>Reviews</h2></div></div>
          @for (review of data()?.probationReviews; track review.id) {
            <div class="large-request" data-testid="probation-review">
              <div><strong>{{ review.employeeName }}</strong><span>by {{ review.reviewedByName }}, {{ formatShortDate(review.reviewedOn) }}</span></div>
              <div><small>OUTCOME</small><strong>{{ outcomes[review.outcome] }}{{ review.extendedTo ? ' to ' + formatShortDate(review.extendedTo) : '' }}</strong></div>
              <div><small>COMMENTS</small><strong>{{ review.comments }}</strong></div>
            </div>
          } @empty {
            <p class="attendance-off">No probation reviews yet. HODs review their people before probation ends.</p>
          }
        </section>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrPerformancePage {
  private readonly api = inject(PerformanceApi);
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
  protected readonly readOn = (date?: string) => (date ? formatShortDate(date) : '');
  protected readonly recommends = (promotion?: boolean, increment?: number) =>
    [promotion ? 'Promotion' : '', increment ? `${increment}% increment` : ''].filter(Boolean).join(', ');

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
