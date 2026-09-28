import { ActionForm } from '@/components/action-form';
import { Card, PageHeader } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import { AccountFields } from '../account-fields';
import { createAccount } from '../actions';

export const runtime = 'edge';

export default async function NewAccountPage() {
  await requireAdmin();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Thêm tài khoản nhận tiền" />
      <Card>
        <ActionForm action={createAccount} submitLabel="Lưu">
          <AccountFields />
        </ActionForm>
      </Card>
    </div>
  );
}
