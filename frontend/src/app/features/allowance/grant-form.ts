import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, required, submit } from '@angular/forms/signals';
import { AllowanceCurrency, AllowanceType } from '../../models/allowance';
import { FieldError } from '../../shared/ui/field-error';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { serverReason } from '../../shared/utils/form-submit';
import { AllowanceApi } from './allowance-api';

const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 1_000_000;
const MAX_REASON = 300;
const FAILED = "That didn't save. Try again in a moment.";

// An HOD grants a report a one-off allowance, with a reason HR and the person will read. HR approves it.
@Component({
  selector: 'app-grant-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="ALLOWANCES" [heading]="'A one-off allowance for ' + name()" intro="HR approves it, then they're told. Nothing is paid until payroll runs." />
    <form novalidate (submit)="save($event)">
      <div class="form-row">
        <label>
          Kind
          <select [formField]="grantForm.type" data-testid="grant-type">
            @for (type of types(); track type.code) {
              <option [value]="type.code">{{ type.name }}</option>
            }
          </select>
        </label>
        <label>Amount <input type="number" step="0.01" [formField]="grantForm.amount" data-testid="grant-amount" aria-describedby="grant-amount-error" /></label>
        <label>
          Currency
          <select [formField]="grantForm.currency" data-testid="grant-currency">
            <option value="MVR">MVR</option>
            <option value="USD">USD</option>
          </select>
        </label>
      </div>
      <app-field-error id="grant-amount-error" [errors]="grantForm.amount().errors()" [isTouched]="grantForm.amount().touched()" />
      <label>Why <textarea [formField]="grantForm.reason" placeholder="Taxis to the site while the ferry was off" data-testid="grant-reason" aria-describedby="grant-reason-error"></textarea></label>
      <app-field-error id="grant-reason-error" [errors]="grantForm.reason().errors()" [isTouched]="grantForm.reason().touched()" />
      @if (failure()) {
        <p role="alert" data-testid="grant-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="grantForm().submitting()" data-testid="grant-submit">Send to HR</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrantForm {
  private readonly api = inject(AllowanceApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly types = input.required<readonly AllowanceType[]>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = linkedSignal(() => ({ type: this.types()[0]?.code ?? '', amount: 0, currency: 'MVR' as AllowanceCurrency, reason: '' }));
  protected readonly grantForm = form(this.draft, (path) => {
    required(path.type, { message: 'Pick a kind.' });
    min(path.amount, MIN_AMOUNT, { message: 'Enter an amount.' });
    max(path.amount, MAX_AMOUNT, { message: 'That’s more than an allowance.' });
    required(path.reason, { message: 'Say why, for HR and for them.' });
    maxLength(path.reason, MAX_REASON, { message: `Keep it under ${MAX_REASON} characters.` });
  });

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.grantForm, async () => {
      const { type, amount, currency, reason } = this.draft();
      try {
        await this.api.grant({ employeeId: this.employeeId(), type, amount: Number(amount), currency, reason: reason.trim() });
        this.saved.emit();
      } catch (error) {
        console.error('Granting an allowance failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
