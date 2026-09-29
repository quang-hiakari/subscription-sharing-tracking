'use client';

import { useId, useState } from 'react';
import { controlClass } from './fields';

interface MoneyFieldProps {
  label: string;
  name: string;
  hint?: string;
  required?: boolean;
  defaultValue?: number;
}

/** A `type="number"` input can't show thousand separators, so this shows a formatted text input
 * (e.g. "1,200,000") and carries the plain digit string for submission in a hidden input under
 * `name`. Validation (positive, integer, etc.) stays server-side, same as any other money field. */
export function MoneyField({ label, name, hint, required, defaultValue }: MoneyFieldProps) {
  const id = useId();
  const [raw, setRaw] = useState(defaultValue != null ? String(defaultValue) : '');
  const display = raw ? Number(raw).toLocaleString('en-US') : '';

  return (
    <label className="block space-y-1" htmlFor={id}>
      <span className="text-sm font-medium">{label}</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        className={controlClass}
        value={display}
        required={required}
        onChange={(e) => setRaw(e.target.value.replace(/[^\d]/g, ''))}
      />
      <input type="hidden" name={name} value={raw} />
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}
