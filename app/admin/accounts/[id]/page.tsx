import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { PageHeader } from '@/components/ui/page-parts';
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
    <div className="max-w-md space-y-8">
      <div>
        <PageHeader title={`Sửa tài khoản: ${account.label}`} />
        <ActionForm action={updateAccount.bind(null, id)} submitLabel="Lưu">
          <AccountFields defaults={account} />
        </ActionForm>
      </div>
      <div className="border-t border-gray-200 pt-4">
        <ActionForm
          action={deleteAccount.bind(null, id)}
          submitLabel="Xoá tài khoản"
          variant="danger"
          confirmMessage="Xoá tài khoản này?"
        />
      </div>
    </div>
  );
}
