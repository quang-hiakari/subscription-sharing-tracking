// Plain form fields (native inputs). Server-component safe.

export const controlClass = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base';

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'> {
  label: string;
  name: string;
  hint?: string;
}

export function Field({ label, name, hint, ...rest }: FieldProps) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input name={name} className={controlClass} {...rest} />
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function TextareaField({
  label,
  name,
  hint,
  ...rest
}: { label: string; name: string; hint?: string } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'>) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <textarea name={name} rows={3} className={controlClass} {...rest} />
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  hint,
  ...rest
}: {
  label: string;
  name: string;
  options: { value: string | number; label: string }[];
  hint?: string;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'name'>) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <select name={name} className={controlClass} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function CheckboxField({
  label,
  name,
  hint,
  ...rest
}: { label: string; name: string; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'type'>) {
  return (
    <label className="flex items-start gap-2">
      <input type="checkbox" name={name} className="mt-1 h-4 w-4" {...rest} />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
    </label>
  );
}
