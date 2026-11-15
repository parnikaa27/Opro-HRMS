import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormField, form, maxLength, min, required, submit } from '@angular/forms/signals';
import { Currency } from '../../models/flight';
import { FieldError } from '../../shared/ui/field-error';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { serverReason } from '../../shared/utils/form-submit';
import { CURRENCIES } from '../../shared/utils/money';
import { CERTIFICATE_ACCEPT, certificateProblem } from '../leave/leave-api';
import { FlightsApi } from './flights-api';

const MAX_ROUTE = 80;
const ONE_CENT = 0.01;
const FAILED = "That didn't go through. Check your connection and try again.";
const RECEIPT_FAILED = "Your claim is in, but the receipt didn't upload. Give it to HR, or cancel the claim and send it again.";

// A flight paid for, claimed back from the allowance. The receipt goes up right after the claim.
@Component({
  selector: 'app-flight-claim-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="FLIGHT ALLOWANCE" heading="Claim a flight" intro="HR checks the receipt and approves it. Rufiyaa and rupees are counted in dollars at HR's rate today." />
    <form novalidate (submit)="save($event)">
      <label>
        Route
        <input [formField]="claimForm.route" placeholder="Malé to Colombo and back" data-testid="claim-route" aria-describedby="claim-route-error" />
      </label>
      <app-field-error id="claim-route-error" [errors]="claimForm.route().errors()" [isTouched]="claimForm.route().touched()" />
      <div class="form-row">
        <label>Flight date <input type="date" [formField]="claimForm.flightDate" data-testid="claim-date" aria-describedby="claim-date-error" /></label>
        <label>Amount <input type="number" step="0.01" [formField]="claimForm.amount" data-testid="claim-amount" aria-describedby="claim-amount-error" /></label>
        <label>
          Currency
          <select [formField]="claimForm.currency" data-testid="claim-currency">
            @for (option of currencies; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </label>
      </div>
      <app-field-error id="claim-date-error" [errors]="claimForm.flightDate().errors()" [isTouched]="claimForm.flightDate().touched()" />
      <app-field-error id="claim-amount-error" [errors]="claimForm.amount().errors()" [isTouched]="claimForm.amount().touched()" />
      <label>
        Receipt or ticket
        <input type="file" [accept]="receiptAccept" (change)="pickReceipt($event)" data-testid="claim-receipt" aria-describedby="claim-receipt-note" />
      </label>
      <p class="modal-intro" id="claim-receipt-note">{{ receiptProblem() ?? 'A PDF, JPG or PNG under 5 MB. Only you and HR can open it.' }}</p>
      @if (failure()) {
        <p role="alert" data-testid="claim-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="claimForm().submitting()" data-testid="claim-submit">{{ claimForm().submitting() ? 'Sending…' : 'Send to HR' }}</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlightClaimForm {
  private readonly api = inject(FlightsApi);
  readonly claimed = output();
  readonly cancelled = output();

  protected readonly currencies = CURRENCIES;
  protected readonly receiptAccept = CERTIFICATE_ACCEPT;
  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly receiptProblem = signal<string | undefined>(undefined);
  private readonly receipt = signal<File | undefined>(undefined);
  protected readonly draft = signal({ route: '', flightDate: '', amount: 0, currency: 'USD' as Currency });
  protected readonly claimForm = form(this.draft, (path) => {
    required(path.route, { message: 'Say where you flew.' });
    maxLength(path.route, MAX_ROUTE, { message: `Keep it under ${MAX_ROUTE} characters.` });
    required(path.flightDate, { message: 'Pick the date you flew.' });
    min(path.amount, ONE_CENT, { message: 'Enter what the ticket cost.' });
  });

  protected pickReceipt(event: Event) {
    const file = event.target instanceof HTMLInputElement ? event.target.files?.[0] : undefined;
    const problem = file && certificateProblem(file);
    this.receiptProblem.set(problem);
    this.receipt.set(problem ? undefined : file);
  }

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.claimForm, async () => {
      const claim = await this.send();
      const receipt = this.receipt();
      if (claim && (!receipt || (await this.attach(claim.id, receipt)))) {
        this.claimed.emit();
      }
      return undefined;
    });
  }

  private async send() {
    const { route, flightDate, amount, currency } = this.draft();
    try {
      return await this.api.claim({ route: route.trim(), flightDate, amount, currency });
    } catch (error) {
      console.error('Claiming a flight failed', error);
      this.failure.set(serverReason(error) ?? FAILED);
      return undefined;
    }
  }

  // The claim is already in when this runs, so a failed upload doesn't undo it.
  private async attach(id: string, receipt: File) {
    try {
      await this.api.attachReceipt(id, receipt);
      return true;
    } catch (error) {
      console.error('Attaching a receipt failed', error);
      this.failure.set(RECEIPT_FAILED);
      return false;
    }
  }
}
