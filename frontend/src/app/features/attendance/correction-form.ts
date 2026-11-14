import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { CorrectionRequest } from '../../models/attendance';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { maldivesToday } from '../../shared/utils/date-time';
import { AttendanceApi } from './attendance-api';

const MAX_REASON = 300;

@Component({
  selector: 'app-correction-form',
  imports: [FormField, FieldError, Icon, ModalHeading],
  template: `
    <app-modal-heading eyebrow="BIOMETRIC RECORDS" heading="Fix a punch" intro="Forgot to punch, or the device was down? Tell your manager what really happened." />
    <form novalidate (submit)="save($event)">
      <div class="form-row">
        <label>
          Day
          <input type="date" [max]="today" [formField]="fixForm.date" data-testid="fix-date" [attr.aria-invalid]="fixForm.date().touched() && fixForm.date().invalid()" aria-describedby="fix-date-error" />
        </label>
        <label>
          Actual time
          <input type="time" [formField]="fixForm.requestedTime" data-testid="fix-time" [attr.aria-invalid]="fixForm.requestedTime().touched() && fixForm.requestedTime().invalid()" aria-describedby="fix-time-error" />
        </label>
      </div>
      <app-field-error id="fix-date-error" [errors]="fixForm.date().errors()" [isTouched]="fixForm.date().touched()" />
      <app-field-error id="fix-time-error" [errors]="fixForm.requestedTime().errors()" [isTouched]="fixForm.requestedTime().touched()" />

      <label>
        What's missing?
        <select [formField]="fixForm.kind" data-testid="fix-kind">
          @for (option of kinds; track option.value) {
            <option [value]="option.value" [selected]="option.value === draft().kind">{{ option.label }}</option>
          }
        </select>
      </label>

      <label>
        What happened?
        <textarea [formField]="fixForm.reason" placeholder="The device at the Hulhumalé site was offline" data-testid="fix-reason" [attr.aria-invalid]="fixForm.reason().touched() && fixForm.reason().invalid()" aria-describedby="fix-reason-error"></textarea>
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
  protected readonly submitFailed = signal(false);

  protected readonly draft = linkedSignal(() => ({ date: this.date(), kind: this.kind(), requestedTime: '', reason: '' }));
  protected readonly fixForm = form(this.draft, (path) => {
    required(path.date, { message: 'Pick the day.' });
    required(path.requestedTime, { message: 'When did you actually punch?' });
    required(path.reason, { message: 'Tell your manager what happened.' });
    maxLength(path.reason, MAX_REASON, { message: `Keep it under ${MAX_REASON} characters.` });
    validate(path.date, ({ value }) => (value() > this.today ? { kind: 'future', message: "You can't fix a day that hasn't happened yet." } : undefined));
  });

  protected async save(event: Event) {
    event.preventDefault();
    this.submitFailed.set(false);
    await submit(this.fixForm, async () => {
      try {
        const { date, kind, requestedTime, reason } = this.draft();
        await this.api.raiseCorrection({ date, kind, requestedTime, reason: reason.trim() });
        this.raised.emit();
      } catch (error) {
        console.error('Raising a correction failed', error);
        this.submitFailed.set(true);
      }
      return undefined;
    });
  }
}
