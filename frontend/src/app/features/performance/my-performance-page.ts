import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Appraisal } from '../../models/performance';
import { Dialog } from '../../shared/ui/dialog';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { formatFullDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { DecisionState } from '../team/decision-state';
import { GoalsForm } from './forms/goals-form';
import { SelfReviewForm } from './forms/self-review-form';
import { GOALS_STATUS, OUTCOMES, PerformanceApi, RATINGS } from './performance-api';
import { SelfReviewView } from './self-review-view';

const GOALS_TONE: Record<string, Tone> = { approved: 'ok', rejected: 'danger', draft: 'neutral' };

// Your goals and self review in the open cycle, your appraisals to accept, and any probation review.
@Component({
  selector: 'app-my-performance-page',
  imports: [Dialog, GoalsForm, ListSkeleton, SelfReviewForm, SelfReviewView, StatusPill],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">MY GROWTH</span>
          <h1>Performance</h1>
          <p>Write your goals for the year and your self review. Your HOD rates the year, and you accept it.</p>
        </div>
      </div>
      @if (mine.error()) {
        <p class="attendance-off">Your performance didn't load. Refresh the page to try again.</p>
      } @else if (mine.isLoading() && !performance()) {
        <app-list-skeleton [count]="3" />
      } @else {
        @if (performance()?.cycle; as cycle) {
          <section class="card card-pad" data-testid="my-goals">
            <div class="card-heading">
              <div><span class="eyebrow">GOALS AND KPIS</span><h2>{{ cycle.name }}</h2></div>
              <app-status-pill [tone]="goalsTone()" data-testid="goals-status">{{ goalsStatus() }}</app-status-pill>
            </div>
            @if (form()?.goalsNote; as note) {
              <p class="card-note" data-testid="goals-note-shown">{{ form()?.goalsDecidedByName }} sent them back: “{{ note }}”</p>
            }
            @for (goal of performance()?.goals; track goal.id) {
              <div class="goal-line" data-testid="my-goal"><strong>{{ goal.title }}</strong><span>{{ goal.measure }} · {{ goal.weight }}%</span></div>
            } @empty {
              <p class="attendance-off">Write two to five goals, each with how it will be measured. Due {{ formatFullDate(cycle.dueOn) }}.</p>
            }
            @if (canEditGoals()) {
              <button type="button" class="primary-button compact" (click)="editing.set('goals')" data-testid="write-goals">{{ performance()?.goals?.length ? 'Change your goals' : 'Write your goals' }}</button>
            }
          </section>
          <section class="card card-pad" data-testid="my-self-review">
            <div class="card-heading">
              <div><span class="eyebrow">SELF REVIEW</span><h2>Your year</h2></div>
              @if (!isAppraised()) {
                <button type="button" class="secondary-button" (click)="editing.set('review')" data-testid="write-self-review">{{ form()?.selfReviewedOn ? 'Update' : 'Write it' }}</button>
              }
            </div>
            <app-self-review-view [review]="form()" emptyText="Your accomplishments, strengths, what you'd like to learn and the certifications you plan. Your HOD reads it before rating your year." />
          </section>
        } @else {
          <p class="attendance-off">No appraisal cycle is open right now. HR opens one each year, and you'll be told.</p>
        }
        @for (appraisal of performance()?.appraisals; track appraisal.id) {
          <section class="card card-pad" [class.needs-you]="!appraisal.acceptedOn" data-testid="my-appraisal">
            <div class="card-heading">
              <div><span class="eyebrow">{{ appraisal.cycleName.toUpperCase() }}</span><h2>{{ appraisal.rating }}, {{ ratings[appraisal.rating] }}</h2></div>
              @if (appraisal.acceptedOn) {
                <span class="card-note">Accepted on {{ formatFullDate(appraisal.acceptedOn) }}</span>
              } @else {
                <button type="button" class="primary-button compact" [disabled]="decisions.busyId() === appraisal.id" (click)="accept(appraisal)" data-testid="accept-rating">Accept my rating</button>
              }
            </div>
            @if (!appraisal.acceptedOn) {
              <p class="card-note" data-testid="accept-needed">Read it, then accept your rating. That's how your appraisal is finished.</p>
            }
            <p class="card-text">“{{ appraisal.comments }}” {{ appraisal.appraisedByName }}, {{ formatFullDate(appraisal.appraisedOn) }}</p>
            @for (goal of appraisal.goals; track goal.id) {
              <div class="goal-line"><strong>{{ goal.title }}</strong><span>{{ goal.rating }}, {{ ratings[goal.rating ?? 0] }}{{ goal.comment ? ' · ' + goal.comment : '' }}</span></div>
            }
            @if (appraisal.selfReviewComment) {
              <p class="card-text" data-testid="self-review-comment-shown">On your self review: “{{ appraisal.selfReviewComment }}”</p>
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

    <app-dialog [heading]="editing() === 'goals' ? 'Your goals' : 'Your self review'" [isOpen]="editing() !== undefined" (isOpenChange)="$event || editing.set(undefined)">
      @if (editing() === 'goals') {
        <app-goals-form [goals]="performance()?.goals ?? []" (saved)="saved()" (cancelled)="editing.set(undefined)" />
      } @else if (editing() === 'review') {
        <app-self-review-form [review]="form() ?? {}" (saved)="saved()" (cancelled)="editing.set(undefined)" />
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyPerformancePage {
  private readonly api = inject(PerformanceApi);
  protected readonly mine = this.api.mine();
  protected readonly performance = computed(() => valueOr(this.mine, undefined));
  protected readonly form = computed(() => this.performance()?.form);
  protected readonly isAppraised = computed(() => this.performance()?.appraisals.some(({ cycleId }) => cycleId === this.performance()?.cycle?.id) ?? false);
  protected readonly canEditGoals = computed(() => ['draft', 'rejected'].includes(this.form()?.goalsStatus ?? 'draft') && !this.isAppraised());
  protected readonly goalsStatus = computed(() => GOALS_STATUS[this.form()?.goalsStatus ?? 'draft']);
  protected readonly goalsTone = computed(() => GOALS_TONE[this.form()?.goalsStatus ?? 'draft'] ?? 'late');
  protected readonly editing = signal<'goals' | 'review' | undefined>(undefined);
  protected readonly decisions = new DecisionState();
  protected readonly ratings = RATINGS;
  protected readonly outcomes = OUTCOMES;
  protected readonly formatFullDate = formatFullDate;

  protected accept({ id }: Appraisal) {
    return this.decisions.run(id, () => this.api.accept(id), () => this.mine.reload());
  }

  protected saved() {
    this.editing.set(undefined);
    this.mine.reload();
  }
}
