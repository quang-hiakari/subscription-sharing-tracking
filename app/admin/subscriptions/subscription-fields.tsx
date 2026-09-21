import { Field, SelectField } from '@/components/ui/fields';
import { CURRENCY_OPTIONS } from '@/lib/currency-options';
import { DEFAULT_REMIND_DAYS_BEFORE } from '@/lib/reminders/constants';

interface Defaults {
  name?: string;
  currency?: string;
  pricePerMonth?: number;
  paymentAccountId?: number;
  remindDaysBefore?: number | null;
}

export function SubscriptionFields({
  accounts,
  defaults = {},
}: {
  accounts: { id: number; label: string; currency: string }[];
  defaults?: Defaults;
}) {
  return (
    <>
      <Field label="Tên" name="name" required maxLength={100} defaultValue={defaults.name} placeholder="Youtube Premium, Microsoft 365..." />
      <SelectField label="Loại tiền" name="currency" options={CURRENCY_OPTIONS} defaultValue={defaults.currency ?? 'JPY'} />
      <Field
        label="Giá mỗi tháng (tổng)"
        name="pricePerMonth"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        required
        defaultValue={defaults.pricePerMonth}
      />
      <SelectField
        label="Tài khoản nhận tiền"
        name="paymentAccountId"
        options={accounts.map((a) => ({ value: a.id, label: `${a.label} (${a.currency})` }))}
        defaultValue={defaults.paymentAccountId}
        hint="Phải cùng loại tiền với subscription."
      />
      <Field
        label="Nhắc trước hạn (ngày)"
        name="remindDaysBefore"
        type="number"
        inputMode="numeric"
        min={0}
        max={60}
        step={1}
        defaultValue={defaults.remindDaysBefore ?? ''}
        hint={`Để trống dùng mặc định ${DEFAULT_REMIND_DAYS_BEFORE} ngày.`}
      />
    </>
  );
}
