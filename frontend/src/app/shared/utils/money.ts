import { Currency } from '../../models/flight';

export const CURRENCIES: readonly Currency[] = ['USD', 'MVR', 'INR'];

// "$1,200.00", "MVR 18,504.00", "₹1,05,600.00"
export const formatMoney = (amount: number, currency: Currency) =>
  new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency }).format(amount);

// Amounts are kept in USD. HR's rates turn them into MVR or INR for reading only.
export const fromUsd = (usd: number, currency: Currency, ratesPerUsd: Partial<Record<Currency, number>>) =>
  currency === 'USD' ? usd : usd * (ratesPerUsd[currency] ?? 0);
