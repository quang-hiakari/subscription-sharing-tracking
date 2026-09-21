import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { PaymentFields } from '@/components/payment-fields';
import { PaymentHistory } from '@/components/payment-history';
import { PageHeader } from '@/components/ui/page-parts';
import { requireAdmin } from '@/lib/auth/require-role';
import type { Currency } from '@/lib/db-schema';
import { todayJst } from '@/lib/format/date';
import { countPaymentsForMembership, getMembership, listRemindersForMembership } from '@/lib/queries/admin';
import { getFx } from '@/lib/queries/fx';
import { listPaymentsForMembership } from '@/lib/queries/payments';
import { deleteMembership, recordMembershipPayment, sendReminderNow, setMembershipArchived, updateMembership } from '../actions';
import { MembershipTermsFields } from '../membership-fields';

export const runtime = 'edge';

function reminderLabel(kind: string): string {
  if (kind === 'manual') return 'Gửi tay';
  if (kind === 't-minus') return 'Trước hạn';
  if (kind === 't0') return 'Đến hạn';
  return `Quá hạn (lần ${kind.replace('overdue-', '')})`;
}

export default async function EditMembershipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const membership = Number.isInteger(id) ? await getMembership(id) : null;
  if (!membership) notFound();
  const hasPayments = (await countPaymentsForMembership(id)) > 0;
  const history = await listPaymentsForMembership(id);
  const reminders = await listRemindersForMembership(id);
  const fx = await getFx();
  const currency = membership.currency as Currency;

  return (
    <div className="max-w-2xl space-y-8">
      <div className="max-w-md">
        <PageHeader title={`${membership.memberName} · ${membership.subscriptionName}`} />
        <ActionForm action={updateMembership.bind(null, id)} submitLabel="Lưu">
          <MembershipTermsFields defaults={membership} />
        </ActionForm>
      </div>

      {!membership.isFamily && !membership.archived && (
        <div className="max-w-md border-t border-gray-200 pt-4">
          <h2 className="mb-3 font-medium">Ghi nhận thanh toán đã nhận</h2>
          <ActionForm action={recordMembershipPayment.bind(null, id)} submitLabel="Ghi nhận">
            <PaymentFields monthlyShare={membership.monthlyShare} currencyLabel={currency} />
          </ActionForm>
        </div>
      )}

      {!membership.isFamily && !membership.archived && (
        <div className="max-w-md space-y-3 border-t border-gray-200 pt-4">
          <h2 className="font-medium">Nhắc thanh toán</h2>
          <ActionForm
            action={sendReminderNow.bind(null, id)}
            submitLabel="Gửi nhắc ngay"
            variant="secondary"
            confirmMessage={`Gửi email nhắc tới ${membership.memberEmail}?`}
          />
          {reminders.length > 0 && (
            <ul className="text-sm text-gray-600">
              {reminders.map((r) => (
                <li key={r.id}>
                  {todayJst(r.sentAt)} · {reminderLabel(r.kind)} · hạn {r.dueDate}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="border-t border-gray-200 pt-4">
        <h2 className="mb-3 font-medium">Lịch sử thanh toán</h2>
        <PaymentHistory rows={history} currency={currency} fx={fx} />
      </div>

      <div className="max-w-md space-y-3 border-t border-gray-200 pt-4">
        {membership.archived ? (
          <ActionForm action={setMembershipArchived.bind(null, id, false)} submitLabel="Bỏ ẩn" variant="secondary" />
        ) : (
          <ActionForm
            action={setMembershipArchived.bind(null, id, true)}
            submitLabel="Ẩn khỏi subscription"
            variant="secondary"
            confirmMessage="Ẩn mục này? Sẽ không còn nhắc và không hiện cho thành viên."
          />
        )}
        {hasPayments ? (
          <p className="text-xs text-gray-500">Đã có lịch sử thanh toán nên không xoá được, chỉ ẩn.</p>
        ) : (
          <ActionForm
            action={deleteMembership.bind(null, id)}
            submitLabel="Xoá"
            variant="danger"
            confirmMessage="Xoá mục này?"
          />
        )}
      </div>
    </div>
  );
}
