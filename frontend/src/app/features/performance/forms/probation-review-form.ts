import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { ProbationOutcome } from '../../../models/performance';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { formatFullDate } from '../../../shared/utils/date-time';
import { serverReason } from '../../../shared/utils/form-submit';
import { PerformanceApi } from '../performance-api';

const FAILED = "That didn't save. Try again in a moment.";

// The HOD's decision before someone's probation ends. HR is told whatever it is.
@Component({
  selector: 'app-probation-review-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="PROBATION" [heading]="'Review ' + name() + '’s probation'" [intro]="intro()" />
    <form novalidate (submit)="save($event)">
      <label>
        Outcome
        <select [formField]="reviewForm.outcome" data-testid="probation-outcome">
          <option value="confirmed">Confirm them in the role</option>
          <option value="extended">Extend probation</option>
          <option value="not-confirmed">Don't confirm them</option>
        </select>
      </label>
      @if (draft().outcome === 'extended') {
        <label>New end date <input type="date" [formField]="reviewForm.extendedTo" [min]="endsOn()" data-testid="probation-extended-to" aria-describedby="extended-to-error" /></label>
        <app-field-error id="extended-to-error" [errors]="reviewForm.extendedTo().errors()" [isTouched]="reviewForm.extendedTo().touched()" />
      }
      <label>Your comments <textarea rows="3" [formField]="reviewForm.comments" placeholder="How they've settled in, and anything to work on" data-testid="probation-comments" aria-describedby="probation-comments-error"></textarea></label>
      <app-field-error id="probation-comments-error" [errors]="reviewForm.comments().errors()" [isTouched]="reviewForm.comments().touched()" />
      @if (failure()) {
        <p role="alert" data-testid="probation-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="reviewForm().submitting()" data-testid="probation-submit">Save review</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProbationReviewForm {
  private readonly api = inject(PerformanceApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly endsOn = input.required<string>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly intro = computed(() => `Their probation ends on ${formatFullDate(this.endsOn())}. They and HR are told what you decide.`);
  protected readonly draft = linkedSignal(() => ({ outcome: 'confirmed' as ProbationOutcome, extendedTo: '', comments: '' }));
  protected readonly reviewForm = form(this.draft, (path) => {
    required(path.comments, { message: 'Write a line or two so they know why.' });
    required(path.extendedTo, { message: 'Pick the new end date.', when: ({ valueOf }) => valueOf(path.outcome) === 'extended' });
  });

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.reviewForm, async () => {
      const { outcome, extendedTo, comments } = this.draft();
      try {
        await this.api.reviewProbation(this.employeeId(), { outcome, ...(outcome === 'extended' && { extendedTo }), comments: comments.trim() });
        this.saved.emit();
      } catch (error) {
        console.error('Saving a probation review failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
