import type { Currency } from '../db-schema';

// JPY and VND have no minor unit, so amounts are whole integers.
const LOCALES: Record<Currency, string> = { JPY: 'ja-JP', VND: 'vi-VN' };

export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALES[currency], {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
