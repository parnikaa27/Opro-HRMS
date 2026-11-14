import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { ProfileApi } from './profile-api';

const MAX_DETAILS = 300;
const FIELDS = ['Phone number', 'Emergency contact', 'Blood group', 'Name', 'Something else'];

@Component({
  selector: 'app-change-request-form',
  imports: [FormField, FieldError, Icon, ModalHeading],
  template: `
    <app-modal-heading eyebrow="YOUR PROFILE" heading="Ask HR to change your details" intro="HR keeps your record, so changes go through them. They'll update it and let you know." />
    <form novalidate (submit)="save($event)">
      <label>
        What needs changing?
        <select [formField]="changeForm.field" data-testid="change-field">
          @for (option of fields; track option) {
            <option [value]="option" [selected]="option === draft().field">{{ option }}</option>
          }
        </select>
      </label>

      <label>
        What should it say?
        <textarea [formField]="changeForm.details" placeholder="+960 777 1234" data-testid="change-details" [attr.aria-invalid]="changeForm.details().touched() && changeForm.details().invalid()" aria-describedby="change-details-error"></textarea>
      </label>
      <app-field-error id="change-details-error" [errors]="changeForm.details().errors()" [isTouched]="changeForm.details().touched()" />

      @if (submitFailed()) {
        <p role="alert">That didn't go through. Check your connection and try again.</p>
      }

      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="changeForm().submitting()" data-testid="change-submit">
          {{ changeForm().submitting() ? 'Sending…' : 'Send to HR' }} <app-icon name="arrow" [size]="16" />
        </button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeRequestForm {
  private readonly api = inject(ProfileApi);
  readonly sent = output();
  readonly cancelled = output();

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
