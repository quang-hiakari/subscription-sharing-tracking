import type { Currency } from '../db-schema';
import type { FxRate } from './rates';

// Display-only conversion between JPY and VND. Billing never uses these numbers.
// The stored rate is "how many VND for 1 JPY".

export function otherCurrency(currency: Currency): Currency {
  return currency === 'JPY' ? 'VND' : 'JPY';
}

/** Converts a whole-unit amount to the other currency, rounded to a whole unit. */
export function convertToOther(amount: number, from: Currency, jpyToVnd: number): number {
  return Math.round(from === 'JPY' ? amount * jpyToVnd : amount / jpyToVnd);
}

/**
 * An amount owed in `from` currency, expressed in `to` currency — unchanged when they match,
 * converted via the daily rate otherwise, or null when a conversion is needed but no rate is
 * known yet (the cron has not fetched one). Used to show what to pay into a specific account
 * whose own currency may differ from the amount's own currency.
 */
export function amountIn(amount: number, from: Currency, to: Currency, fx: FxRate | null): number | null {
  if (from === to) return amount;
  return fx ? convertToOther(amount, from, fx.rate) : null;
}

export type Sums = Record<Currency, number>;

export function sumByCurrency(rows: { currency: Currency; amount: number }[]): Sums {
  const sums: Sums = { JPY: 0, VND: 0 };
  for (const row of rows) sums[row.currency] += row.amount;
  return sums;
}

/** Everything expressed in VND, for a single rough total. */
export function totalInVnd(sums: Sums, jpyToVnd: number): number {
  return Math.round(sums.VND + sums.JPY * jpyToVnd);
}
