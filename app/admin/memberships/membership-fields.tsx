import { CheckboxField, Field, SelectField } from '@/components/ui/fields';
import { MoneyField } from '@/components/ui/money-field';
import { CURRENCY_OPTIONS } from '@/lib/currency-options';
import type { BillingCycle } from '@/lib/db-schema';

interface Defaults {
  currency?: string;
  monthlyShare?: number;
  isFamily?: boolean;
  paidThrough?: string;
}

/** Terms shared by the create and edit forms. The share amount follows the subscription's own
 * billing cycle (a yearly subscription's share is a yearly amount, not a monthly one), but its
 * currency is per member: a VND-billed subscription can collect JPY from someone in Japan. */
export function MembershipTermsFields({
  defaults = {},
  billingCycle = 'monthly',
}: {
  defaults?: Defaults;
  billingCycle?: BillingCycle;
}) {
  const cycleWord = billingCycle === 'yearly' ? 'năm' : 'tháng';
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <MoneyField
          label={`Số tiền mỗi ${cycleWord} của người này`}
          name="monthlyShare"
          required
          defaultValue={defaults.monthlyShare}
        />
        <SelectField
          label="Loại tiền người này trả"
          name="currency"
          options={CURRENCY_OPTIONS}
          defaultValue={defaults.currency ?? 'JPY'}
          hint="Không cần giống loại tiền của subscription."
        />
        <Field
          label="Trả đến ngày (hạn thanh toán tiếp theo)"
          name="paidThrough"
          type="date"
          required
          defaultValue={defaults.paidThrough}
          hint="Đây là ngày đến hạn kế tiếp; sẽ tự dời khi thanh toán được duyệt."
        />
      </div>
      <CheckboxField
        label="Người nhà"
        name="isFamily"
        defaultChecked={defaults.isFamily}
        hint="Không bị nhắc và không tính là nợ."
      />
    </>
  );
}
