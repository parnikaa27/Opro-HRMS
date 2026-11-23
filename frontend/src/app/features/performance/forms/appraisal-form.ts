import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, max, min, required, submit } from '@angular/forms/signals';
import { Goal, PlanEntry } from '../../../models/performance';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { serverReason } from '../../../shared/utils/form-submit';
import { PerformanceApi, PerformanceScope, RATINGS } from '../performance-api';
import { PlanView } from '../plan-view';

const MAX_INCREMENT = 100;
const MIDDLE = '3';
const FAILED = "That didn't save. Try again in a moment.";

// The HOD rates each goal and the year overall, from 1 to 5. Final once saved.
@Component({
  selector: 'app-appraisal-form',
  imports: [FieldError, FormField, ModalHeading, PlanView],
  template: `
    <app-modal-heading eyebrow="Performance" [heading]="'Appraise ' + name()" intro="Once saved it can't be changed, and they're told it's ready to read." />
    <form novalidate (submit)="save($event)">
      @for (goal of appraisalForm.goals; track $index; let index = $index) {
        <fieldset class="goal-fields" data-testid="rate-goal">
          <legend>{{ goals()[index].title }} <small>{{ goals()[index].weight }}%</small></legend>
          <div class="form-row">
            <label>
              Rating
              <select [formField]="goal.rating" data-testid="goal-rating">
                @for (option of scale; track option.value) {
                  <option [value]="option.value">{{ option.value }}, {{ option.label }}</option>
                }
              </select>
            </label>
            <label>Comment <input [formField]="goal.comment" placeholder="Optional" data-testid="goal-comment" /></label>
          </div>
        </fieldset>
      }
      <label>
        Overall rating
        <select [formField]="appraisalForm.rating" data-testid="overall-rating">
          @for (option of scale; track option.value) {
            <option [value]="option.value">{{ option.value }}, {{ option.label }}</option>
          }
        </select>
      </label>
      @if (goalAverage(); as average) {
        <p class="weight-total" data-testid="goal-average">Weighted by goal, the ratings come to {{ average }}.</p>
      }
      <fieldset class="goal-fields" data-testid="their-self-review">
        <legend>The rest of their plan</legend>
        <app-plan-view [entries]="entries()" [hasGoals]="false" />
        <label>Your comment on it <textarea rows="2" [formField]="appraisalForm.selfReviewComment" placeholder="Optional. The course is a good idea; book it for January." data-testid="self-review-comment"></textarea></label>
      </fieldset>
      <label>Your comments <textarea rows="4" [formField]="appraisalForm.comments" placeholder="What went well this year, and what to work on next" data-testid="appraisal-comments" aria-describedby="appraisal-comments-error"></textarea></label>
      <app-field-error id="appraisal-comments-error" [errors]="appraisalForm.comments().errors()" [isTouched]="appraisalForm.comments().touched()" />
      <fieldset class="goal-fields">
        <legend>For HR <small>They don't see this</small></legend>
        <label class="check-label"><input type="checkbox" [formField]="appraisalForm.promotion" data-testid="recommend-promotion" /> Recommend a promotion</label>
        <label>Recommended increment (%) <input type="number" step="0.5" [formField]="appraisalForm.increment" data-testid="recommend-increment" aria-describedby="increment-error" /></label>
        <app-field-error id="increment-error" [errors]="appraisalForm.increment().errors()" [isTouched]="appraisalForm.increment().touched()" />
      </fieldset>
      @if (failure()) {
        <p role="alert" data-testid="appraisal-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="appraisalForm().submitting()" data-testid="appraisal-submit">Save appraisal</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppraisalForm {
  private readonly api = inject(PerformanceApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly goals = input<readonly Goal[]>([]);
  readonly entries = input<readonly PlanEntry[]>([]);
  readonly scope = input<PerformanceScope>('team');
  readonly saved = output();
  readonly cancelled = output();

  protected readonly scale = Object.entries(RATINGS).map(([value, label]) => ({ value, label }));
  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = linkedSignal(() => ({
    goals: this.goals().map(() => ({ rating: MIDDLE, comment: '' })),
    rating: MIDDLE,
    comments: '',
    promotion: false,
    increment: 0,
    selfReviewComment: '',
  }));
  protected readonly goalAverage = computed(() => {
    const goals = this.goals();
    const ratings = this.draft().goals;
    return goals.length ? (goals.reduce((sum, { weight }, index) => sum + weight * Number(ratings[index]?.rating), 0) / goals.reduce((sum, { weight }) => sum + weight, 0)).toFixed(1) : undefined;
  });
  protected readonly appraisalForm = form(this.draft, (path) => {
    required(path.comments, { message: 'Write a few lines so they know why.' });
    min(path.increment, 0, { message: 'It can’t be negative.' });
    max(path.increment, MAX_INCREMENT, { message: 'At most 100%.' });
  });

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.appraisalForm, async () => {
      const { goals, rating, comments, promotion, increment, selfReviewComment } = this.draft();
      try {
        await this.api.appraise(
          this.employeeId(),
          {
          rating: Number(rating),
          comments: comments.trim(),
          recommendsPromotion: promotion,
          ...(Number(increment) > 0 && { incrementPercent: Number(increment) }),
          ...(selfReviewComment.trim() && { selfReviewComment: selfReviewComment.trim() }),
          goals: this.goals().map(({ id }, index) => ({ goalId: id, rating: Number(goals[index].rating), ...(goals[index].comment.trim() && { comment: goals[index].comment.trim() }) })),
          },
          this.scope(),
        );
        this.saved.emit();
      } catch (error) {
        console.error('Saving an appraisal failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
