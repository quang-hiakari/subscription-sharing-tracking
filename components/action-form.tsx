'use client';

import { useActionState } from 'react';
import type { FormState } from '@/lib/form-state';

const VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
} as const;

interface ActionFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  variant?: keyof typeof VARIANTS;
  /** Asks the browser to confirm before submitting (destructive actions). */
  confirmMessage?: string;
  children?: React.ReactNode;
}

/** A form bound to a Server Action that shows the action's error message and a pending state. */
export function ActionForm({ action, submitLabel, variant = 'primary', confirmMessage, children }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
      className="space-y-3"
    >
      {state.error && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      {children}
      <button
        type="submit"
        disabled={pending}
        className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${VARIANTS[variant]}`}
      >
        {pending ? 'Đang xử lý...' : submitLabel}
      </button>
    </form>
  );
}
