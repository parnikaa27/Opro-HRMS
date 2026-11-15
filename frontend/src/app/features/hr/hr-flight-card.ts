import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormField, form, max, min, submit } from '@angular/forms/signals';
import { serverReason } from '../../shared/utils/form-submit';
import { valueOr } from '../../shared/utils/resource';
import { FlightSummary } from '../flights/flight-summary';
import { HrApi } from './hr-api';

const MAX_ALLOWANCE = 1_000_000;

// One person's flight allowance on their HR page: set this year's amount in USD, and see every claim.
@Component({
  selector: 'app-hr-flight-card',
  imports: [FlightSummary, FormField],
  template: `
    <section class="card card-pad" data-testid="hr-flight-card">
      <div class="card-heading">
        <div>
          <span class="eyebrow">FLIGHT ALLOWANCE</span>
          <h2>Flights home</h2>
        </div>
      </div>
      @if (flights.error()) {
        <p class="attendance-off">Their flight allowance didn't load. Refresh the page to try again.</p>
      } @else if (year(); as current) {
        <form novalidate class="inline-form" (submit)="save($event)">
          <label>Allowance for {{ current.year }} (USD) <input type="number" step="1" [formField]="allowanceForm.amountUsd" data-testid="allowance-amount" /></label>
          <button type="submit" class="secondary-button" [disabled]="allowanceForm().submitting() || allowanceForm().invalid()" data-testid="allowance-submit">Set allowance</button>
        </form>
        @if (failure()) {
          <p class="row-error" role="alert">{{ failure() }}</p>
        }
        <app-flight-summary [year]="current" receiptPath="/api/hr/flight-claims" />
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrFlightCard {
  private readonly api = inject(HrApi);
  readonly employeeId = input.required<string>();

  protected readonly flights = this.api.employeeFlights(this.employeeId);
  protected readonly year = computed(() => valueOr(this.flights, undefined));
  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = linkedSignal(() => ({ amountUsd: this.year()?.allowanceUsd ?? 0 }));
  protected readonly allowanceForm = form(this.draft, (path) => {
    min(path.amountUsd, 0, { message: 'An allowance can’t be negative.' });
    max(path.amountUsd, MAX_ALLOWANCE, { message: 'That’s more than any flight costs.' });
  });

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.allowanceForm, async () => {
      const year = this.year()?.year;
      if (year === undefined) {
        return undefined;
      }
      try {
        await this.api.setFlightAllowance(this.employeeId(), year, this.draft().amountUsd);
        this.flights.reload();
      } catch (error) {
        console.error('Setting a flight allowance failed', error);
        this.failure.set(serverReason(error) ?? "That didn't save. Try again in a moment.");
      }
      return undefined;
    });
  }
}
