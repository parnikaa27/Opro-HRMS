import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { CorrectionRequest } from '../../models/attendance';
import { FieldError } from '../../shared/ui/field-error';
import { maldivesToday } from '../../shared/utils/date-time';
import { AttendanceApi } from './attendance-api';

const MAX_REASON = 300;

@Component({
  selector: 'app-correction-form',
  imports: [FormField, FieldError],
  template: `
    <form class="space-y-5" novalidate (submit)="save($event)">
      <p class="text-sm text-soft">Forgot to punch, or the device was down? Tell your manager what really happened and they'll fix the record.</p>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="fix-date">Day</label>
          <input id="fix-date" type="date" class="field-input" [max]="today" [formField]="fixForm.date" data-testid="fix-date"
            [attr.aria-invalid]="fixForm.date().touched() && fixForm.date().invalid()" aria-describedby="fix-date-error" />
          <app-field-error id="fix-date-error" [errors]="fixForm.date().errors()" [isTouched]="fixForm.date().touched()" />
        </div>
        <div>
          <label class="field-label" for="fix-time">Actual time</label>
          <input id="fix-time" type="time" class="field-input" [formField]="fixForm.requestedTime" data-testid="fix-time"
            [attr.aria-invalid]="fixForm.requestedTime().touched() && fixForm.requestedTime().invalid()" aria-describedby="fix-time-error" />
          <app-field-error id="fix-time-error" [errors]="fixForm.requestedTime().errors()" [isTouched]="fixForm.requestedTime().touched()" />
        </div>
      </div>

      <fieldset>
        <legend class="field-label">What's missing?</legend>
        <div class="flex flex-wrap gap-2">
          @for (option of kinds; track option.value) {
            <label class="flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2 text-sm has-checked:border-sea has-checked:bg-sea-soft has-checked:text-sea">
              <input type="radio" class="sr-only" [value]="option.value" [formField]="fixForm.kind" />
              {{ option.label }}
            </label>
          }
        </div>
      </fieldset>

      <div>
        <label class="field-label" for="fix-reason">What happened?</label>
        <textarea id="fix-reason" rows="3" class="field-input" [formField]="fixForm.reason" placeholder="The device at the Hulhumalé site was offline" data-testid="fix-reason"
          [attr.aria-invalid]="fixForm.reason().touched() && fixForm.reason().invalid()" aria-describedby="fix-reason-error"></textarea>
        <app-field-error id="fix-reason-error" [errors]="fixForm.reason().errors()" [isTouched]="fixForm.reason().touched()" />
      </div>

      @if (submitFailed()) {
        <p class="text-sm text-danger" role="alert">That didn't go through. Check your connection and try again.</p>
      }

      <div class="flex justify-end">
        <button type="submit" class="btn-primary" [disabled]="fixForm().submitting()" data-testid="fix-submit">
          {{ fixForm().submitting() ? 'Sending…' : 'Send to my manager' }}
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
