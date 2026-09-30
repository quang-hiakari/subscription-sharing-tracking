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
  paymentAccountIds?: number[];
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
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Tài khoản nhận tiền</legend>
          <div className="space-y-1 rounded-md border border-gray-300 bg-white p-2">
            {accounts.map((a) => (
              <label key={a.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="paymentAccountIds"
                  value={a.id}
                  defaultChecked={defaults.paymentAccountIds?.includes(a.id) ?? false}
                />
                {a.label} ({a.currency})
              </label>
            ))}
          </div>
          <span className="block text-xs text-gray-500">
            Chọn 1 hoặc nhiều tài khoản. Không cần cùng loại tiền với subscription — mỗi tài khoản hiện số tiền quy đổi riêng cho thành viên.
          </span>
        </fieldset>
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
