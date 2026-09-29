'use client';

import { useState } from 'react';
import { Field, SelectField } from '@/components/ui/fields';
import { MoneyField } from '@/components/ui/money-field';
import { CURRENCY_OPTIONS } from '@/lib/currency-options';
import { DEFAULT_REMIND_DAYS_BEFORE } from '@/lib/reminders/constants';

type BillingCycle = 'monthly' | 'yearly';

interface Defaults {
  name?: string;
  currency?: string;
  billingCycle?: string;
  billingAmount?: number;
  slotCount?: number;
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

      <div className="grid gap-4 sm:grid-cols-3">
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
        <MoneyField
          label={cycle === 'monthly' ? 'Tổng tiền mỗi tháng' : 'Tổng tiền mỗi năm'}
          name="billingAmount"
          required
          defaultValue={defaults.billingAmount}
        />
        <Field
          label="Số slot chia sẻ"
          name="slotCount"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          defaultValue={defaults.slotCount ?? 1}
          hint="Để tính số tiền tham khảo mỗi người."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Tài khoản nhận tiền"
          name="paymentAccountId"
          options={accounts.map((a) => ({ value: a.id, label: `${a.label} (${a.currency})` }))}
          defaultValue={defaults.paymentAccountId}
          hint="Không cần cùng loại tiền với subscription — thành viên vẫn thấy quy đổi (≈)."
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
