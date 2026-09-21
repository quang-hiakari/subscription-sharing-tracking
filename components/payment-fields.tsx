import { Field } from '@/components/ui/fields';
import { MAX_MONTHS_PER_PAYMENT } from '@/lib/payments/service';

/** Fields shared by "member reports a payment" and "admin records a payment". */
export function PaymentFields({ monthlyShare, currencyLabel }: { monthlyShare: number; currencyLabel: string }) {
  return (
    <>
      <Field label="Số tháng đã trả" name="monthsCovered" type="number" inputMode="numeric" min={1} max={MAX_MONTHS_PER_PAYMENT} step={1} required defaultValue={1} />
      <Field
        label="Số tiền (tuỳ chọn)"
        name="amount"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        hint={`Để trống = ${monthlyShare.toLocaleString('en-US')} ${currencyLabel} × số tháng.`}
      />
      <Field label="Ghi chú (tuỳ chọn)" name="note" maxLength={200} />
    </>
  );
}
