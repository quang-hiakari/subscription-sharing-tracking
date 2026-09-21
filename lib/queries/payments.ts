import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDrizzle } from '@/lib/db';
import { members, memberships, paymentAccounts, payments, subscriptions } from '@/lib/db-schema';

// Payment reads for the admin queue and the member dashboard.

function paymentsWithContext() {
  return getDrizzle()
    .select({
      id: payments.id,
      membershipId: payments.membershipId,
      monthsCovered: payments.monthsCovered,
      amount: payments.amount,
      status: payments.status,
      note: payments.note,
      rejectReason: payments.rejectReason,
      createdAt: payments.createdAt,
      decidedAt: payments.decidedAt,
      memberName: members.name,
      memberEmail: members.email,
      subscriptionName: subscriptions.name,
      currency: subscriptions.currency,
      paidThrough: memberships.paidThrough,
    })
    .from(payments)
    .innerJoin(memberships, eq(payments.membershipId, memberships.id))
    .innerJoin(members, eq(memberships.memberId, members.id))
    .innerJoin(subscriptions, eq(memberships.subscriptionId, subscriptions.id));
}

export async function listPendingPayments() {
  return paymentsWithContext().where(eq(payments.status, 'pending')).orderBy(payments.createdAt);
}

export async function listRecentDecidedPayments(limit = 30) {
  return paymentsWithContext()
    .where(inArray(payments.status, ['approved', 'rejected']))
    .orderBy(desc(payments.decidedAt))
    .limit(limit);
}

export async function listPaymentsForMembership(membershipId: number) {
  return paymentsWithContext().where(eq(payments.membershipId, membershipId)).orderBy(desc(payments.createdAt));
}

/**
 * A member's active memberships with account details and payment history.
 * Same "active" rule as the admin side: membership and member both not archived.
 */
export async function getMyMemberships(memberId: number) {
  const db = getDrizzle();
  const rows = await db
    .select({
      id: memberships.id,
      subscriptionName: subscriptions.name,
      currency: subscriptions.currency,
      monthlyShare: memberships.monthlyShare,
      isFamily: memberships.isFamily,
      paidThrough: memberships.paidThrough,
      remindDaysBefore: subscriptions.remindDaysBefore,
      accountLabel: paymentAccounts.label,
      accountDetails: paymentAccounts.details,
    })
    .from(memberships)
    .innerJoin(members, eq(memberships.memberId, members.id))
    .innerJoin(subscriptions, eq(memberships.subscriptionId, subscriptions.id))
    .innerJoin(paymentAccounts, eq(subscriptions.paymentAccountId, paymentAccounts.id))
    .where(and(eq(memberships.memberId, memberId), eq(memberships.archived, false), eq(members.archived, false)))
    .orderBy(subscriptions.name);
  if (rows.length === 0) return [];

  const history = await db
    .select()
    .from(payments)
    .where(inArray(payments.membershipId, rows.map((r) => r.id)))
    .orderBy(desc(payments.createdAt));
  return rows.map((row) => ({ ...row, payments: history.filter((p) => p.membershipId === row.id) }));
}
