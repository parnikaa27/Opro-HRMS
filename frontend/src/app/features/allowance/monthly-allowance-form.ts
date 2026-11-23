import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, required, submit } from '@angular/forms/signals';
import { AllowanceCurrency, AllowanceType, MonthlyAllowance } from '../../models/allowance';
import { FieldError } from '../../shared/ui/field-error';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { addMonths, maldivesToday, monthOf } from '../../shared/utils/date-time';
import { serverReason } from '../../shared/utils/form-submit';
import { AllowanceApi } from './allowance-api';

const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 1_000_000;
const MAX_NOTE = 300;
const FAILED = "That didn't save. Try again in a moment.";

// HR sets what someone gets of one kind every month, from a month on. Changing one starts the new amount that month.
@Component({
  selector: 'app-monthly-allowance-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="Allowances" [heading]="current() ? 'Change ' + current()?.typeName?.toLowerCase() + ' allowance' : 'Add a monthly allowance'" intro="The old amount ends the month before the new one starts. They're told." />
    <form novalidate (submit)="save($event)">
      @if (!current()) {
        <label>
          Kind
          <select [formField]="allowanceForm.type" data-testid="monthly-type">
            @for (type of types(); track type.code) {
              <option [value]="type.code">{{ type.name }}</option>
            }
          </select>
        </label>
      }
      <div class="form-row">
        <label>Amount a month <input type="number" step="0.01" [formField]="allowanceForm.amount" data-testid="monthly-amount" aria-describedby="monthly-amount-error" /></label>
        <label>
          Currency
          <select [formField]="allowanceForm.currency" data-testid="monthly-currency">
            <option value="MVR">MVR</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label>From <input type="month" [formField]="allowanceForm.month" data-testid="monthly-month" aria-describedby="monthly-month-error" /></label>
      </div>
      <app-field-error id="monthly-amount-error" [errors]="allowanceForm.amount().errors()" [isTouched]="allowanceForm.amount().touched()" />
      <app-field-error id="monthly-month-error" [errors]="allowanceForm.month().errors()" [isTouched]="allowanceForm.month().touched()" />
      <label>Note <input [formField]="allowanceForm.note" placeholder="Optional. Moved to the Hulhumalé site" data-testid="monthly-note" /></label>
      @if (failure()) {
        <p role="alert" data-testid="monthly-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="allowanceForm().submitting()" data-testid="monthly-submit">Save</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthlyAllowanceForm {
  private readonly api = inject(AllowanceApi);
  readonly employeeId = input.required<string>();
  readonly types = input.required<readonly AllowanceType[]>();
  // The one being changed. Left out to add a new kind.
  readonly current = input<MonthlyAllowance>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = linkedSignal(() => ({
    type: this.current()?.typeCode ?? this.types()[0]?.code ?? '',
    amount: this.current()?.amount ?? 0,
    currency: (this.current()?.currency ?? 'MVR') as AllowanceCurrency,
    month: addMonths(monthOf(maldivesToday()), 1),
    note: '',
  }));
  protected readonly allowanceForm = form(this.draft, (path) => {
    required(path.type, { message: 'Pick a kind.' });
    min(path.amount, MIN_AMOUNT, { message: 'Enter an amount.' });
    max(path.amount, MAX_AMOUNT, { message: 'That’s more than an allowance.' });
    required(path.month, { message: 'Pick the month it starts.' });
    maxLength(path.note, MAX_NOTE, { message: `Keep it under ${MAX_NOTE} characters.` });
  });

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.allowanceForm, async () => {
      const { type, amount, currency, month, note } = this.draft();
      try {
        await this.api.setMonthly(this.employeeId(), type, { amount: Number(amount), currency, startsOn: `${month}-01`, ...(note.trim() && { note: note.trim() }) });
        this.saved.emit();
      } catch (error) {
        console.error('Saving an allowance failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
