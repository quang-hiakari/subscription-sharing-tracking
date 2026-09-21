import { Field, SelectField, TextareaField } from '@/components/ui/fields';
import { CURRENCY_OPTIONS } from '@/lib/currency-options';

interface Defaults {
  currency?: string;
  label?: string;
  details?: string;
}

export function AccountFields({ defaults = {} }: { defaults?: Defaults }) {
  return (
    <>
      <SelectField label="Loại tiền" name="currency" options={CURRENCY_OPTIONS} defaultValue={defaults.currency ?? 'JPY'} />
      <Field label="Tên tài khoản" name="label" required maxLength={100} defaultValue={defaults.label} placeholder="Yucho, Vietcombank..." />
      <TextareaField
        label="Thông tin nhận tiền"
        name="details"
        required
        maxLength={500}
        defaultValue={defaults.details}
        hint="Hiện cho thành viên và trong email nhắc. Ví dụ: số tài khoản, tên chủ tài khoản."
      />
    </>
  );
}
