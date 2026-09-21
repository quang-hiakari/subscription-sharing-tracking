import type { Currency } from '@/lib/db-schema';
import { convertToOther, otherCurrency } from '@/lib/fx/convert';
import type { FxRate } from '@/lib/fx/rates';
import { formatMoney } from '@/lib/format/money';

/** An amount in its own currency, followed by a muted "≈" value in the other one when a rate is known. */
export function Money({ amount, currency, fx }: { amount: number; currency: Currency; fx: FxRate | null }) {
  const other = otherCurrency(currency);
  return (
    <>
      {formatMoney(amount, currency)}
      {fx && amount !== 0 && (
        <span className="ml-1 text-xs font-normal text-gray-500">≈ {formatMoney(convertToOther(amount, currency, fx.rate), other)}</span>
      )}
    </>
  );
}

/** Explains the "≈" values and credits the rate source (required by its free-tier terms). Renders nothing without a rate. */
export function FxNote({ fx }: { fx: FxRate | null }) {
  if (!fx) return null;
  return (
    <p className="text-xs text-gray-500">
      Giá trị &ldquo;≈&rdquo; chỉ để tham khảo: 1 JPY = {fx.rate.toLocaleString('en-US', { maximumFractionDigits: 2 })} VND (ngày {fx.date}). Tỷ giá từ{' '}
      <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="underline">
        ExchangeRate-API
      </a>
      .
    </p>
  );
}
