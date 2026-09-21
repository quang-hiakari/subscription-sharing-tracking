import { ActionForm } from '@/components/action-form';
import { PageHeader } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import { AccountFields } from '../account-fields';
import { createAccount } from '../actions';

export const runtime = 'edge';

export default async function NewAccountPage() {
  await requireAdmin();
  return (
    <div className="max-w-md">
      <PageHeader title="Thêm tài khoản nhận tiền" />
      <ActionForm action={createAccount} submitLabel="Lưu">
        <AccountFields />
      </ActionForm>
    </div>
  );
}
