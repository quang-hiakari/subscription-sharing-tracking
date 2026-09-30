'use client';

import { useState } from 'react';

type Choice = 'keep' | '6' | '12' | 'custom';

/**
 * How many periods to credit when approving a pending payment: keep what the member reported,
 * jump straight to a common bulk case (6 months / 1 year), or type any other number. The custom
 * field only activates once its own checkbox is checked, so it can never be submitted by
 * accident alongside a preset.
 */
export function ApproveMonthsChoice({ reportedMonths }: { reportedMonths: number }) {
  const [choice, setChoice] = useState<Choice>('keep');

  return (
    <fieldset className="space-y-1.5 text-sm">
      <legend className="text-sm font-medium">Số kỳ được duyệt</legend>
      <label className="flex items-center gap-1.5">
        <input type="radio" name="monthsChoice" value="keep" checked={choice === 'keep'} onChange={() => setChoice('keep')} />
        Giữ nguyên đã báo ({reportedMonths} kỳ)
      </label>
      <label className="flex items-center gap-1.5">
        <input type="radio" name="monthsChoice" value="6" checked={choice === '6'} onChange={() => setChoice('6')} />
        6 tháng
      </label>
      <label className="flex items-center gap-1.5">
        <input type="radio" name="monthsChoice" value="12" checked={choice === '12'} onChange={() => setChoice('12')} />
        1 năm (12 tháng)
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          name="monthsChoice"
          value="custom"
          checked={choice === 'custom'}
          onChange={(e) => setChoice(e.target.checked ? 'custom' : 'keep')}
        />
        Số tháng khác:
        <input
          type="number"
          name="customMonths"
          min={1}
          max={36}
          step={1}
          disabled={choice !== 'custom'}
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
        />
      </label>
    </fieldset>
  );
}
