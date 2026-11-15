import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { CorrectionRequest, FixCategory } from '../../models/attendance';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { maldivesToday } from '../../shared/utils/date-time';
import { AttendanceApi } from './attendance-api';
import { FIX_CATEGORIES, NEEDS_REASON } from './fix-categories';

const MAX_REASON = 300;
const PLACEHOLDERS: Record<FixCategory, string> = {
  resort: 'At the Client resort all day for the handover',
  forgot: 'Rushed into a meeting and forgot',
  late: 'There was a queue at the gate, I was in at 8:55',
  other: 'Tell your manager what happened',
};

@Component({
  selector: 'app-correction-form',
  imports: [FormField, FieldError, Icon, ModalHeading],
  template: `
    <app-modal-heading eyebrow="ATTENDANCE RECORDS" heading="Fix a punch" intro="Missed a punch, or punched in late? Tell your manager what really happened." />
    <form novalidate (submit)="save($event)">
      <label>
        What happened?
        <select [formField]="fixForm.category" data-testid="fix-category">
          @for (option of categories; track option.value) {
            <option [value]="option.value" [selected]="option.value === draft().category">{{ option.label }}</option>
          }
        </select>
      </label>
      <div class="form-row">
        <label>
          Day
          <input type="date" [max]="today" [formField]="fixForm.date" data-testid="fix-date" [attr.aria-invalid]="fixForm.date().touched() && fixForm.date().invalid()" aria-describedby="fix-date-error" />
        </label>
        <label>
          {{ isLate() ? 'When you actually arrived' : 'Actual time' }}
          <input type="time" [formField]="fixForm.requestedTime" data-testid="fix-time" [attr.aria-invalid]="fixForm.requestedTime().touched() && fixForm.requestedTime().invalid()" aria-describedby="fix-time-error" />
        </label>
      </div>
      <app-field-error id="fix-date-error" [errors]="fixForm.date().errors()" [isTouched]="fixForm.date().touched()" />
      <app-field-error id="fix-time-error" [errors]="fixForm.requestedTime().errors()" [isTouched]="fixForm.requestedTime().touched()" />

      @if (!isLate()) {
        <label>
          Which punch?
          <select [formField]="fixForm.kind" data-testid="fix-kind">
            @for (option of kinds; track option.value) {
              <option [value]="option.value" [selected]="option.value === draft().kind">{{ option.label }}</option>
            }
          </select>
        </label>
      }

      <label>
        {{ needsReason() ? 'Reason' : 'Note, if you like' }}
        <textarea [formField]="fixForm.reason" [placeholder]="placeholders[draft().category]" data-testid="fix-reason" [attr.aria-invalid]="fixForm.reason().touched() && fixForm.reason().invalid()" aria-describedby="fix-reason-error"></textarea>
      </label>
      <app-field-error id="fix-reason-error" [errors]="fixForm.reason().errors()" [isTouched]="fixForm.reason().touched()" />

      @if (submitFailed()) {
        <p role="alert">That didn't go through. Check your connection and try again.</p>
      }

      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="fixForm().submitting()" data-testid="fix-submit">
          {{ fixForm().submitting() ? 'Sending…' : 'Send to my manager' }} <app-icon name="arrow" [size]="16" />
        </button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorrectionForm {
  private readonly api = inject(AttendanceApi);

  readonly date = input('');
  readonly kind = input<CorrectionRequest['kind']>('missed-out');
  readonly raised = output();
  readonly cancelled = output();

  protected readonly today = maldivesToday();
  protected readonly kinds = [
    { value: 'missed-in', label: 'My punch in' },
    { value: 'missed-out', label: 'My punch out' },
  ] as const;
  protected readonly categories = FIX_CATEGORIES;
  protected readonly placeholders = PLACEHOLDERS;
  protected readonly submitFailed = signal(false);

  protected readonly draft = linkedSignal(() => ({ date: this.date(), kind: this.kind(), category: 'forgot' as FixCategory, requestedTime: '', reason: '' }));
  // A late punch is always about the punch in, so the form doesn't ask which.
  protected readonly isLate = computed(() => this.draft().category === 'late');
  protected readonly needsReason = computed(() => NEEDS_REASON.has(this.draft().category));
  protected readonly fixForm = form(this.draft, (path) => {
    required(path.date, { message: 'Pick the day.' });
    required(path.requestedTime, { message: 'When did you actually punch?' });
    validate(path.reason, ({ value }) => (this.needsReason() && !value().trim() ? { kind: 'required', message: 'Tell your manager what happened.' } : undefined));
    maxLength(path.reason, MAX_REASON, { message: `Keep it under ${MAX_REASON} characters.` });
    validate(path.date, ({ value }) => (value() > this.today ? { kind: 'future', message: "You can't fix a day that hasn't happened yet." } : undefined));
  });

  protected async save(event: Event) {
    event.preventDefault();
    this.submitFailed.set(false);
    await submit(this.fixForm, async () => {
      try {
        const { date, kind, category, requestedTime, reason } = this.draft();
        await this.api.raiseCorrection({ date, kind: category === 'late' ? 'missed-in' : kind, category, requestedTime, ...(reason.trim() && { reason: reason.trim() }) });
        this.raised.emit();
      } catch (error) {
        console.error('Raising a correction failed', error);
        this.submitFailed.set(true);
      }
      return undefined;
    });
  }
}
