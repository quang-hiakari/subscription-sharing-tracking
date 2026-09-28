'use client';

import { useState } from 'react';
import { Field, SelectField } from '@/components/ui/fields';
import { CURRENCY_OPTIONS } from '@/lib/currency-options';
import { DEFAULT_REMIND_DAYS_BEFORE } from '@/lib/reminders/constants';

type BillingCycle = 'monthly' | 'yearly';

interface Defaults {
  name?: string;
  currency?: string;
  billingCycle?: string;
  billingAmount?: number;
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
  const [cycle, setCycle] = useState<BillingCycle>((defaults.billingCycle as BillingCycle) ?? 'monthly');

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tên" name="name" required maxLength={100} defaultValue={defaults.name} placeholder="Youtube Premium, Microsoft 365..." />
        <SelectField label="Loại tiền" name="currency" options={CURRENCY_OPTIONS} defaultValue={defaults.currency ?? 'JPY'} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Chu kỳ trả tiền"
          name="billingCycle"
          options={[
            { value: 'monthly', label: 'Trả theo tháng' },
            { value: 'yearly', label: 'Trả theo năm' },
          ]}
          value={cycle}
          onChange={(e) => setCycle(e.target.value as BillingCycle)}
        />
        <Field
          label={cycle === 'monthly' ? 'Giá mỗi tháng (tổng)' : 'Giá mỗi năm (tổng)'}
          name="billingAmount"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          defaultValue={defaults.billingAmount}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>
    </>
  );
}
