import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { Card, PageHeader } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import { getAccount } from '@/lib/queries/admin';
import { AccountFields } from '../account-fields';
import { deleteAccount, updateAccount } from '../actions';

export const runtime = 'edge';

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const account = Number.isInteger(id) ? await getAccount(id) : null;
  if (!account) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={`Sửa tài khoản: ${account.label}`} />
      <Card>
        <ActionForm action={updateAccount} submitLabel="Lưu" hidden={{ id }}>
          <AccountFields defaults={account} />
        </ActionForm>
      </Card>
      <Card>
        <ActionForm
          action={deleteAccount}
          submitLabel="Xoá tài khoản"
          variant="danger"
          confirmMessage="Xoá tài khoản này?"
          hidden={{ id }}
        />
      </Card>
    </div>
  );
}
