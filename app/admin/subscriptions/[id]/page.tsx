import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { PageHeader } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import { getSubscription, listAccounts } from '@/lib/queries/admin';
import { deleteSubscription, updateSubscription } from '../actions';
import { SubscriptionFields } from '../subscription-fields';

export const runtime = 'edge';

export default async function EditSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const subscription = Number.isInteger(id) ? await getSubscription(id) : null;
  if (!subscription) notFound();
  const accounts = await listAccounts();

  return (
    <div className="max-w-md space-y-8">
      <div>
        <PageHeader title={`Sửa subscription: ${subscription.name}`} />
        <ActionForm action={updateSubscription.bind(null, id)} submitLabel="Lưu">
          <SubscriptionFields accounts={accounts} defaults={subscription} />
        </ActionForm>
      </div>
      <div className="border-t border-gray-200 pt-4">
        <ActionForm
          action={deleteSubscription.bind(null, id)}
          submitLabel="Xoá subscription"
          variant="danger"
          confirmMessage="Xoá subscription này?"
        />
      </div>
    </div>
  );
}
