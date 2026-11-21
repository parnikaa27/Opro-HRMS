import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SelfReview } from '../../models/performance';

const PARTS: readonly { key: keyof SelfReview; label: string }[] = [
  { key: 'accomplishments', label: 'Accomplishments' },
  { key: 'strengths', label: 'Strengths' },
  { key: 'learning', label: 'Learning and development' },
  { key: 'certifications', label: 'Plan for certifications' },
];

// Someone's self review, read only: on their own page, and for their HOD and HR.
@Component({
  selector: 'app-self-review-view',
  template: `
    @if (written().length) {
      <dl class="self-review" data-testid="self-review">
        @for (part of written(); track part.label) {
          <div><dt>{{ part.label }}</dt><dd>{{ part.text }}</dd></div>
        }
      </dl>
    } @else {
      <p class="card-note" data-testid="self-review-empty">{{ emptyText() }}</p>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelfReviewView {
  readonly review = input<SelfReview | undefined>();
  readonly emptyText = input('Nothing written yet.');

  protected readonly written = computed(() =>
    PARTS.map(({ key, label }) => ({ label, text: this.review()?.[key] ?? '' })).filter(({ text }) => text !== ''),
  );
}
