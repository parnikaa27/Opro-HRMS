import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, validate } from '@angular/forms/signals';
import { FieldError } from '../../shared/ui/field-error';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { addDays, maldivesToday } from '../../shared/utils/date-time';
import { serverReason, submitForm } from '../../shared/utils/form-submit';
import { ExitApi } from './exit-api';

const MAX_REASON = 500;

// Putting in a resignation: why, and the last day they'd like. Today is the day it's put in.
@Component({
  selector: 'app-resignation-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="LEAVING OPRO" heading="Resign" intro="Your HOD approves it first, then HR, who confirms your exit date. You can withdraw it while it waits." />
    <form novalidate (submit)="save($event)">
      <label>Last day you'd like <input type="date" [min]="tomorrow" [formField]="resignForm.releaseOn" data-testid="resign-date" aria-describedby="resign-date-error" /></label>
      <app-field-error id="resign-date-error" [errors]="resignForm.releaseOn().errors()" [isTouched]="resignForm.releaseOn().touched()" />
      <label>Reason <textarea [formField]="resignForm.reason" placeholder="I'm moving back home to be near family." data-testid="resign-reason" aria-describedby="resign-reason-error"></textarea></label>
      <app-field-error id="resign-reason-error" [errors]="resignForm.reason().errors()" [isTouched]="resignForm.reason().touched()" />
      @if (failed()) {
        <p role="alert" data-testid="resign-error">{{ problem() ?? "That didn't go through. Try again in a moment." }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button danger" [disabled]="resignForm().submitting()" data-testid="resign-submit">Put in my resignation</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResignationForm {
  private readonly api = inject(ExitApi);
  readonly sent = output();
  readonly cancelled = output();

  protected readonly tomorrow = addDays(maldivesToday(), 1);
  protected readonly failed = signal(false);
  protected readonly problem = signal<string | undefined>(undefined);
  protected readonly draft = signal({ releaseOn: '', reason: '' });
  protected readonly resignForm = form(this.draft, (path) => {
    required(path.releaseOn, { message: 'Pick the last day you’d like.' });
    validate(path.releaseOn, ({ value }) => (value() && value() < this.tomorrow ? { kind: 'past', message: 'Pick a day after today.' } : undefined));
    required(path.reason, { message: 'Say why, for your record.' });
    maxLength(path.reason, MAX_REASON, { message: `Keep it under ${MAX_REASON} characters.` });
  });

  protected save(event: Event) {
    this.problem.set(undefined);
    return submitForm(event, this.resignForm, this.failed, async () => {
      try {
        await this.api.resign({ releaseOn: this.draft().releaseOn, reason: this.draft().reason.trim() });
        this.sent.emit();
      } catch (error) {
        this.problem.set(serverReason(error));
        throw error;
      }
    });
  }
}
