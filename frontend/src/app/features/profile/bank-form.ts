import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormField, form, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { BankAccount } from '../../models/record';
import { FieldError } from '../../shared/ui/field-error';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { serverReason } from '../../shared/utils/form-submit';
import { ProfileApi } from './profile-api';

const ACCOUNT_NUMBER = /^[0-9 ]{6,40}$/;
const MAX_TEXT = 120;
const FAILED = "That didn't save. Check your connection and try again.";

// Someone entering the account their pay goes to. HR checks it before payroll uses it.
@Component({
  selector: 'app-bank-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="Bank details" heading="Where your pay goes" intro="HR checks these against your bank letter before payroll uses them. Only you and HR can see them." />
    <form novalidate (submit)="save($event)">
      <label>Bank <input [formField]="bankForm.bankName" list="banks" placeholder="Bank of Maldives" data-testid="bank-name" aria-describedby="bank-name-error" /></label>
      <datalist id="banks">
        @for (bank of banks; track bank) {
          <option [value]="bank"></option>
        }
      </datalist>
      <app-field-error id="bank-name-error" [errors]="bankForm.bankName().errors()" [isTouched]="bankForm.bankName().touched()" />
      <label>Name on the account <input [formField]="bankForm.accountName" data-testid="bank-account-name" aria-describedby="bank-account-name-error" /></label>
      <app-field-error id="bank-account-name-error" [errors]="bankForm.accountName().errors()" [isTouched]="bankForm.accountName().touched()" />
      <div class="form-row">
        <label>Account number <input inputmode="numeric" autocomplete="off" [formField]="bankForm.accountNumber" data-testid="bank-number" aria-describedby="bank-number-error" /></label>
        <label>
          Currency
          <select [formField]="bankForm.currency" data-testid="bank-currency">
            <option value="MVR">MVR</option>
            <option value="USD">USD</option>
          </select>
        </label>
      </div>
      <app-field-error id="bank-number-error" [errors]="bankForm.accountNumber().errors()" [isTouched]="bankForm.accountNumber().touched()" />
      @if (failure()) {
        <p role="alert" data-testid="bank-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="bankForm().submitting()" data-testid="bank-submit">Send to HR</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankForm {
  private readonly api = inject(ProfileApi);
  readonly saved = output();
  readonly cancelled = output();

  // The usual banks in the Maldives. Anything else can be typed.
  protected readonly banks = ['Bank of Maldives', 'Maldives Islamic Bank', 'State Bank of India', 'Commercial Bank of Maldives', 'HSBC'];
  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = signal({ bankName: '', accountName: '', accountNumber: '', currency: 'MVR' as BankAccount['currency'] });
  protected readonly bankForm = form(this.draft, (path) => {
    required(path.bankName, { message: 'Enter your bank.' });
    maxLength(path.bankName, MAX_TEXT, { message: `Keep it under ${MAX_TEXT} characters.` });
    required(path.accountName, { message: 'Enter the name on the account.' });
    maxLength(path.accountName, MAX_TEXT, { message: `Keep it under ${MAX_TEXT} characters.` });
    required(path.accountNumber, { message: 'Enter the account number.' });
    pattern(path.accountNumber, ACCOUNT_NUMBER, { message: 'Use 6 to 40 digits.' });
  });

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.bankForm, async () => {
      const { bankName, accountName, accountNumber, currency } = this.draft();
      try {
        await this.api.saveBank({ bankName: bankName.trim(), accountName: accountName.trim(), accountNumber: accountNumber.replace(/\s/g, ''), currency });
        this.saved.emit();
      } catch (error) {
        console.error('Saving bank details failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
