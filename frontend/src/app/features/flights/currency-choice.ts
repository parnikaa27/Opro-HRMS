import { Injectable, signal } from '@angular/core';
import { Currency } from '../../models/flight';
import { CURRENCIES } from '../../shared/utils/money';
import { readPreference, savePreference } from '../../shared/utils/preference';

const CURRENCY_KEY = 'opro.currency';

// The currency flight amounts are shown in, remembered per browser.
@Injectable({ providedIn: 'root' })
export class CurrencyChoice {
  readonly currency = signal<Currency>(readPreference(CURRENCY_KEY, CURRENCIES, 'USD'));

  choose(currency: Currency) {
    this.currency.set(currency);
    savePreference(CURRENCY_KEY, currency);
  }
}
