import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormField, form, min, submit } from '@angular/forms/signals';
import { valueOr } from '../../shared/utils/resource';
import { FlightsApi } from '../flights/flights-api';
import { HrApi } from './hr-api';

const SMALLEST_RATE = 0.01;

// What one US dollar buys. Flight allowances are kept in USD and shown in MVR or INR with these.
@Component({
  selector: 'app-exchange-rates-card',
  imports: [FormField],
  template: `
    <section class="card card-pad" data-testid="rates-card">
      <div class="card-heading">
        <div>
          <span class="eyebrow">Flight allowance</span>
          <h2>Exchange rates</h2>
        </div>
      </div>
      <p class="card-text">New flight claims in rufiyaa or rupees are counted in dollars at these rates. Claims already made keep the rate they had.</p>
      <form novalidate class="inline-form" (submit)="save($event)">
        <label>MVR for 1 USD <input type="number" step="0.01" [formField]="ratesForm.mvr" data-testid="rate-mvr" /></label>
        <label>INR for 1 USD <input type="number" step="0.01" [formField]="ratesForm.inr" data-testid="rate-inr" /></label>
        <button type="submit" class="secondary-button" [disabled]="ratesForm().submitting() || ratesForm().invalid()" data-testid="rates-submit">Save rates</button>
      </form>
      @if (status(); as message) {
        <p [attr.role]="message === saved ? 'status' : 'alert'" data-testid="rates-status">{{ message }}</p>
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExchangeRatesCard {
  private readonly hr = inject(HrApi);
  // Anyone can read the rates with their own allowance. HR is no exception.
  private readonly year = inject(FlightsApi).year();
  protected readonly saved = 'Saved. New claims use these rates.';
  protected readonly status = signal<string | undefined>(undefined);
  private readonly rates = computed(() => valueOr(this.year, undefined)?.ratesPerUsd ?? {});
  protected readonly draft = linkedSignal(() => ({ mvr: this.rates().MVR ?? 0, inr: this.rates().INR ?? 0 }));
  protected readonly ratesForm = form(this.draft, (path) => {
    min(path.mvr, SMALLEST_RATE, { message: 'A rate has to be more than zero.' });
    min(path.inr, SMALLEST_RATE, { message: 'A rate has to be more than zero.' });
  });

  protected save(event: Event) {
    event.preventDefault();
    this.status.set(undefined);
    return submit(this.ratesForm, async () => {
      try {
        await this.hr.saveRates(this.draft());
        this.status.set(this.saved);
        this.year.reload();
      } catch (error) {
        console.error('Saving exchange rates failed', error);
        this.status.set("That didn't save. Try again in a moment.");
      }
      return undefined;
    });
  }
}
