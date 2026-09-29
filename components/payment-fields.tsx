import { Field } from '@/components/ui/fields';
import { MoneyField } from '@/components/ui/money-field';
import type { BillingCycle } from '@/lib/db-schema';
import { MAX_MONTHS_PER_PAYMENT } from '@/lib/payments/service';

/** Fields shared by "member reports a payment" and "admin records a payment". `monthsCovered` is
 * really "số kỳ đã trả" — one kỳ is one of the subscription's own billing cycles. */
export function PaymentFields({
  monthlyShare,
  currencyLabel,
  billingCycle = 'monthly',
}: {
  monthlyShare: number;
  currencyLabel: string;
  billingCycle?: BillingCycle;
}) {
  const cycleWord = billingCycle === 'yearly' ? 'năm' : 'tháng';
  return (
    <>
      <Field
        label={`Số ${cycleWord} đã trả`}
        name="monthsCovered"
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_MONTHS_PER_PAYMENT}
        step={1}
        required
        defaultValue={1}
      />
      <MoneyField
        label="Số tiền (tuỳ chọn)"
        name="amount"
        hint={`Để trống = ${monthlyShare.toLocaleString('en-US')} ${currencyLabel} × số ${cycleWord}.`}
      />
      <Field label="Ghi chú (tuỳ chọn)" name="note" maxLength={200} />
    </>
  );
}
