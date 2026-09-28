import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { Card, EmptyState, PageHeader } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import { listAccounts } from '@/lib/queries/admin';
import { createSubscription } from '../actions';
import { SubscriptionFields } from '../subscription-fields';

export const runtime = 'edge';

export default async function NewSubscriptionPage() {
  await requireAdmin();
  const accounts = await listAccounts();

  if (accounts.length === 0) {
    return (
      <EmptyState>
        Cần có tài khoản nhận tiền trước. <Link href="/admin/accounts/new" className="text-blue-700 underline">Thêm tài khoản</Link>
      </EmptyState>
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Thêm subscription" />
      <Card>
        <ActionForm action={createSubscription} submitLabel="Lưu">
          <SubscriptionFields accounts={accounts} />
        </ActionForm>
      </Card>
    </div>
  );
}
