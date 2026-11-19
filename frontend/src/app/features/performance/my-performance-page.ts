import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Appraisal } from '../../models/performance';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { formatFullDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { DecisionState } from '../team/decision-state';
import { OUTCOMES, PerformanceApi, RATINGS } from './performance-api';

// Your goals in the open cycle, your appraisals, and any probation review.
@Component({
  selector: 'app-my-performance-page',
  imports: [ListSkeleton],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">MY GROWTH</span>
          <h1>Performance</h1>
          <p>Your goals for the year, how your HOD rated them, and your probation review.</p>
        </div>
      </div>
      @if (mine.error()) {
        <p class="attendance-off">Your performance didn't load. Refresh the page to try again.</p>
      } @else if (mine.isLoading() && !performance()) {
        <app-list-skeleton [count]="3" />
      } @else {
        <section class="card card-pad" data-testid="my-goals">
          <div class="card-heading"><div><span class="eyebrow">GOALS</span><h2>{{ performance()?.cycle?.name ?? 'This year' }}</h2></div></div>
          @for (goal of performance()?.goals; track goal.id) {
            <div class="goal-line" data-testid="my-goal"><strong>{{ goal.title }}</strong><span>{{ goal.measure }} · {{ goal.weight }}%</span></div>
          } @empty {
            <p class="attendance-off">{{ performance()?.cycle ? 'Your HOD hasn’t set your goals yet.' : 'No appraisal cycle is open right now.' }}</p>
          }
        </section>
        @for (appraisal of performance()?.appraisals; track appraisal.id) {
          <section class="card card-pad" data-testid="my-appraisal">
            <div class="card-heading">
              <div><span class="eyebrow">{{ appraisal.cycleName.toUpperCase() }}</span><h2>{{ appraisal.rating }}, {{ ratings[appraisal.rating] }}</h2></div>
              @if (appraisal.acknowledgedOn) {
                <span class="card-note">Read on {{ formatFullDate(appraisal.acknowledgedOn) }}</span>
              } @else {
                <button type="button" class="primary-button compact" [disabled]="decisions.busyId() === appraisal.id" (click)="acknowledge(appraisal)" data-testid="acknowledge">I've read it</button>
              }
            </div>
            <p class="card-text">“{{ appraisal.comments }}” {{ appraisal.appraisedByName }}, {{ formatFullDate(appraisal.appraisedOn) }}</p>
            @for (goal of appraisal.goals; track goal.id) {
              <div class="goal-line"><strong>{{ goal.title }}</strong><span>{{ goal.rating }}, {{ ratings[goal.rating ?? 0] }}{{ goal.comment ? ' · ' + goal.comment : '' }}</span></div>
            }
            @if (decisions.failedId() === appraisal.id) {
              <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
            }
          </section>
        }
        @for (review of performance()?.probationReviews; track review.id) {
          <section class="card card-pad" data-testid="my-probation">
            <div class="card-heading"><div><span class="eyebrow">PROBATION</span><h2>{{ outcomes[review.outcome] }}{{ review.extendedTo ? ' until ' + formatFullDate(review.extendedTo) : '' }}</h2></div></div>
            <p class="card-text">“{{ review.comments }}” {{ review.reviewedByName }}, {{ formatFullDate(review.reviewedOn) }}</p>
          </section>
        }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyPerformancePage {
  private readonly api = inject(PerformanceApi);
  protected readonly mine = this.api.mine();
  protected readonly performance = computed(() => valueOr(this.mine, undefined));
  protected readonly decisions = new DecisionState();
  protected readonly ratings = RATINGS;
  protected readonly outcomes = OUTCOMES;
  protected readonly formatFullDate = formatFullDate;

  protected acknowledge({ id }: Appraisal) {
    return this.decisions.run(id, () => this.api.acknowledge(id), () => this.mine.reload());
  }
}
