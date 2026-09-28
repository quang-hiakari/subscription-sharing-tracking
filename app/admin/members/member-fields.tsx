import { Field } from '@/components/ui/fields';

export function MemberFields({ defaults = {} }: { defaults?: { name?: string; email?: string } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Tên" name="name" required maxLength={100} defaultValue={defaults.name} />
      <Field
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="off"
        defaultValue={defaults.email}
        hint="Dùng để đăng nhập và nhận email nhắc."
      />
    </div>
  );
}
