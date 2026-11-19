import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, submit } from '@angular/forms/signals';
import { SelfReview } from '../../../models/performance';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { serverReason } from '../../../shared/utils/form-submit';
import { PerformanceApi } from '../performance-api';

const MAX_TEXT = 2000;
const FAILED = "That didn't save. Try again in a moment.";

// What someone says about their year, for their HOD to read and comment on. Theirs to change until they're appraised.
@Component({
  selector: 'app-self-review-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="PERFORMANCE" heading="Your self review" intro="Your HOD reads this before rating your year. Write as much or as little as you like, and change it until you're appraised." />
    <form novalidate (submit)="save($event)">
      <label>Accomplishments <textarea rows="3" [formField]="reviewForm.accomplishments" placeholder="What you delivered this year" data-testid="review-accomplishments" aria-describedby="review-accomplishments-error"></textarea></label>
      <app-field-error id="review-accomplishments-error" [errors]="reviewForm.accomplishments().errors()" [isTouched]="reviewForm.accomplishments().touched()" />
      <label>Strengths <textarea rows="3" [formField]="reviewForm.strengths" placeholder="What you're good at, and what people come to you for" data-testid="review-strengths" aria-describedby="review-strengths-error"></textarea></label>
      <app-field-error id="review-strengths-error" [errors]="reviewForm.strengths().errors()" [isTouched]="reviewForm.strengths().touched()" />
      <label>Learning and development <textarea rows="3" [formField]="reviewForm.learning" placeholder="Courses, skills or experience you'd like next year" data-testid="review-learning" aria-describedby="review-learning-error"></textarea></label>
      <app-field-error id="review-learning-error" [errors]="reviewForm.learning().errors()" [isTouched]="reviewForm.learning().touched()" />
      <label>Plan for certifications <textarea rows="3" [formField]="reviewForm.certifications" placeholder="Which ones, and by when" data-testid="review-certifications" aria-describedby="review-certifications-error"></textarea></label>
      <app-field-error id="review-certifications-error" [errors]="reviewForm.certifications().errors()" [isTouched]="reviewForm.certifications().touched()" />
      @if (failure()) {
        <p role="alert" data-testid="review-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="reviewForm().submitting()" data-testid="review-submit">Save</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelfReviewForm {
  private readonly api = inject(PerformanceApi);
  readonly review = input<SelfReview>({});
  readonly saved = output();
  readonly cancelled = output();

  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = linkedSignal(() => ({
    accomplishments: this.review().accomplishments ?? '',
    strengths: this.review().strengths ?? '',
    learning: this.review().learning ?? '',
    certifications: this.review().certifications ?? '',
  }));
  protected readonly reviewForm = form(this.draft, (path) => {
    const tooLong = { message: `Keep it under ${MAX_TEXT} characters.` };
    maxLength(path.accomplishments, MAX_TEXT, tooLong);
    maxLength(path.strengths, MAX_TEXT, tooLong);
    maxLength(path.learning, MAX_TEXT, tooLong);
    maxLength(path.certifications, MAX_TEXT, tooLong);
  });

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.reviewForm, async () => {
      const { accomplishments, strengths, learning, certifications } = this.draft();
      try {
        await this.api.writeSelfReview({ accomplishments: accomplishments.trim(), strengths: strengths.trim(), learning: learning.trim(), certifications: certifications.trim() });
        this.saved.emit();
      } catch (error) {
        console.error('Saving a self review failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
