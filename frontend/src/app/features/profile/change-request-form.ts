import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { FieldError } from '../../shared/ui/field-error';
import { ProfileApi } from './profile-api';

const MAX_DETAILS = 300;
const FIELDS = ['Phone number', 'Emergency contact', 'Blood group', 'Name', 'Something else'];

@Component({
  selector: 'app-change-request-form',
  imports: [FormField, FieldError],
  template: `
    <form class="space-y-5" novalidate (submit)="save($event)">
      <p class="text-sm text-soft">HR keeps your record, so changes go through them. They'll update it and let you know.</p>

      <div>
        <label class="field-label" for="change-field">What needs changing?</label>
        <select id="change-field" class="field-input" [formField]="changeForm.field" data-testid="change-field">
          @for (option of fields; track option) {
            <option [value]="option">{{ option }}</option>
          }
        </select>
      </div>

      <div>
        <label class="field-label" for="change-details">What should it say?</label>
        <textarea id="change-details" rows="3" class="field-input" [formField]="changeForm.details" placeholder="+960 777 1234" data-testid="change-details"
          [attr.aria-invalid]="changeForm.details().touched() && changeForm.details().invalid()" aria-describedby="change-details-error"></textarea>
        <app-field-error id="change-details-error" [errors]="changeForm.details().errors()" [isTouched]="changeForm.details().touched()" />
      </div>

      @if (submitFailed()) {
        <p class="text-sm text-danger" role="alert">That didn't go through. Check your connection and try again.</p>
      }

      <div class="flex justify-end">
        <button type="submit" class="btn-primary" [disabled]="changeForm().submitting()" data-testid="change-submit">
          {{ changeForm().submitting() ? 'Sending…' : 'Send to HR' }}
        </button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeRequestForm {
  private readonly api = inject(ProfileApi);
  readonly sent = output();

  protected readonly fields = FIELDS;
  protected readonly submitFailed = signal(false);
  protected readonly draft = signal({ field: FIELDS[0], details: '' });
  protected readonly changeForm = form(this.draft, (path) => {
    required(path.details, { message: 'Tell HR what the new details are.' });
    maxLength(path.details, MAX_DETAILS, { message: `Keep it under ${MAX_DETAILS} characters.` });
  });

  protected async save(event: Event) {
    event.preventDefault();
    this.submitFailed.set(false);
    await submit(this.changeForm, async () => {
      try {
        const { field, details } = this.draft();
        await this.api.requestChange({ field, details: details.trim() });
        this.sent.emit();
      } catch (error) {
        console.error('Sending a profile change failed', error);
        this.submitFailed.set(true);
      }
      return undefined;
    });
  }
}
