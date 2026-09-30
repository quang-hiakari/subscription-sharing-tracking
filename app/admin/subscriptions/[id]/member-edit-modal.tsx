'use client';

import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { Modal } from '@/components/ui/modal';
import { updateMembership } from '@/app/admin/memberships/actions';
import { MembershipTermsFields } from '@/app/admin/memberships/membership-fields';
import type { BillingCycle } from '@/lib/db-schema';

interface MembershipRow {
  id: number;
  memberName: string;
  currency: string;
  monthlyShare: number;
  isFamily: boolean;
  paidThrough: string;
  memo: string | null;
}

/** Quick "edit terms" popup for a member row on the subscription page, so editing doesn't leave
 * the page. Rarer actions (record payment, reminders, payment history, archive, delete) still
 * live on the full membership page, linked from inside the popup. */
export function MemberEditModal({
  membership,
  subscriptionId,
  billingCycle,
  triggerClassName,
}: {
  membership: MembershipRow;
  subscriptionId: number;
  billingCycle: BillingCycle;
  triggerClassName?: string;
}) {
  return (
    <Modal trigger={membership.memberName} triggerClassName={triggerClassName} title={`Sửa: ${membership.memberName}`}>
      <ActionForm
        action={updateMembership}
        submitLabel="Lưu"
        hidden={{ id: membership.id, returnTo: `/admin/subscriptions/${subscriptionId}` }}
      >
        <MembershipTermsFields defaults={membership} billingCycle={billingCycle} />
      </ActionForm>
      <Link href={`/admin/memberships/${membership.id}`} className="mt-3 block text-sm text-blue-700 hover:underline">
        Xem chi tiết: thanh toán, nhắc, ẩn/xoá →
      </Link>
    </Modal>
  );
}
