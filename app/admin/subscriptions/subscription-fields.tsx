'use client';

import { useState } from 'react';
import { Field, SelectField } from '@/components/ui/fields';
import { CURRENCY_OPTIONS } from '@/lib/currency-options';
import { yearlyToMonthly } from '@/lib/format/money';
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
  // The submitted field is always "Giá mỗi tháng"; the yearly input is a one-shot helper
  // that fills it (rounded, ÷12) and is never itself submitted (no `name` attribute).
  const [monthly, setMonthly] = useState<number | ''>(defaults.pricePerMonth ?? '');

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
        value={monthly}
        onChange={(e) => setMonthly(e.target.value === '' ? '' : Number(e.target.value))}
      />
      <Field
        label="Nhập theo năm (tuỳ chọn)"
        name=""
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        placeholder="1200000"
        onChange={(e) => {
          const yearly = Number(e.target.value);
          if (e.target.value !== '' && yearly > 0) setMonthly(yearlyToMonthly(yearly));
        }}
        hint="Điền để tự tính giá/tháng, không lưu riêng."
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
