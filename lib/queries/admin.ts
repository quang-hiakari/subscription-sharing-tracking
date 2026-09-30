import { and, count, desc, eq, ne } from 'drizzle-orm';
import { getDrizzle } from '@/lib/db';
import { members, memberships, paymentAccounts, payments, reminderLog, subscriptions } from '@/lib/db-schema';
import { membershipStatus } from './membership-status';

// Read helpers for the admin screens. Mutations live in each screen's actions.ts.

export async function listAccounts() {
  return getDrizzle().select().from(paymentAccounts).orderBy(paymentAccounts.currency, paymentAccounts.label);
}

export async function getAccount(id: number) {
  const [row] = await getDrizzle().select().from(paymentAccounts).where(eq(paymentAccounts.id, id));
  return row ?? null;
}

export async function listSubscriptions() {
  return getDrizzle()
    .select({
      id: subscriptions.id,
      name: subscriptions.name,
      currency: subscriptions.currency,
      billingCycle: subscriptions.billingCycle,
      billingAmount: subscriptions.billingAmount,
      slotCount: subscriptions.slotCount,
      remindDaysBefore: subscriptions.remindDaysBefore,
      accountLabel: paymentAccounts.label,
    })
    .from(subscriptions)
    .innerJoin(paymentAccounts, eq(subscriptions.paymentAccountId, paymentAccounts.id))
    .orderBy(subscriptions.name);
}

export async function getSubscription(id: number) {
  const [row] = await getDrizzle().select().from(subscriptions).where(eq(subscriptions.id, id));
  return row ?? null;
}

export async function listMembers() {
  return getDrizzle().select().from(members).orderBy(members.name);
}

export async function getMember(id: number) {
  const [row] = await getDrizzle().select().from(members).where(eq(members.id, id));
  return row ?? null;
}

/**
 * Memberships joined with member and subscription. By default archived memberships and
 * memberships of archived members are excluded; this is the same "active" rule the
 * dashboard and reminders rely on. Pass `subscriptionId` to scope to one subscription
 * (used by the subscription detail page).
 */
export async function listMemberships(includeArchived = false, subscriptionId?: number) {
  const activeFilter = includeArchived ? undefined : and(eq(memberships.archived, false), eq(members.archived, false));
  const scopeFilter = subscriptionId === undefined ? undefined : eq(memberships.subscriptionId, subscriptionId);
  return getDrizzle()
    .select({
      id: memberships.id,
      memberId: members.id,
      memberName: members.name,
      memberEmail: members.email,
      subscriptionId: subscriptions.id,
      subscriptionName: subscriptions.name,
      // The share amount and its currency both come from the membership, not the subscription.
      currency: memberships.currency,
      billingCycle: subscriptions.billingCycle,
      monthlyShare: memberships.monthlyShare,
      isFamily: memberships.isFamily,
      paidThrough: memberships.paidThrough,
      remindDaysBefore: subscriptions.remindDaysBefore,
      archived: memberships.archived,
      memberArchived: members.archived,
    })
    .from(memberships)
    .innerJoin(members, eq(memberships.memberId, members.id))
    .innerJoin(subscriptions, eq(memberships.subscriptionId, subscriptions.id))
    .where(and(activeFilter, scopeFilter))
    .orderBy(subscriptions.name, members.name);
}

export async function getMembership(id: number) {
  const [row] = await getDrizzle()
    .select({
      id: memberships.id,
      memberName: members.name,
      memberEmail: members.email,
      subscriptionId: subscriptions.id,
      subscriptionName: subscriptions.name,
      // The share amount and its currency both come from the membership, not the subscription.
      currency: memberships.currency,
      billingCycle: subscriptions.billingCycle,
      monthlyShare: memberships.monthlyShare,
      isFamily: memberships.isFamily,
      paidThrough: memberships.paidThrough,
      archived: memberships.archived,
    })
    .from(memberships)
    .innerJoin(members, eq(memberships.memberId, members.id))
    .innerJoin(subscriptions, eq(memberships.subscriptionId, subscriptions.id))
    .where(eq(memberships.id, id));
  return row ?? null;
}

/** Active members not already in this subscription (any status, since re-adding an archived one is blocked). */
export async function listAvailableMembersForSubscription(subscriptionId: number) {
  const taken = await getDrizzle().select({ memberId: memberships.memberId }).from(memberships).where(eq(memberships.subscriptionId, subscriptionId));
  const takenIds = new Set(taken.map((t) => t.memberId));
  const all = await listMembers();
  return all.filter((m) => !m.archived && !takenIds.has(m.id));
}

/** Non-family active memberships that are overdue or due within their lead time, most urgent first. */
export async function listAttention(today: string) {
  const rows = await listMemberships(false);
  return rows
    .map((row) => ({ ...row, ...membershipStatus(row, today) }))
    .filter((row) => row.status === 'overdue' || row.status === 'due_soon')
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

export async function countPendingPayments(): Promise<number> {
  const [row] = await getDrizzle().select({ n: count() }).from(payments).where(eq(payments.status, 'pending'));
  return row.n;
}

// Reference counts used by delete guards.

export async function countSubscriptionsForAccount(accountId: number): Promise<number> {
  const [row] = await getDrizzle().select({ n: count() }).from(subscriptions).where(eq(subscriptions.paymentAccountId, accountId));
  return row.n;
}

export async function countMembershipsForSubscription(subscriptionId: number): Promise<number> {
  const [row] = await getDrizzle().select({ n: count() }).from(memberships).where(eq(memberships.subscriptionId, subscriptionId));
  return row.n;
}

export async function countMembershipsForMember(memberId: number): Promise<number> {
  const [row] = await getDrizzle().select({ n: count() }).from(memberships).where(eq(memberships.memberId, memberId));
  return row.n;
}

export async function countPaymentsForMembership(membershipId: number): Promise<number> {
  const [row] = await getDrizzle().select({ n: count() }).from(payments).where(eq(payments.membershipId, membershipId));
  return row.n;
}

/** True when another member already uses this email (case-insensitive: emails are stored lowercase). */
export async function emailTaken(email: string, exceptMemberId?: number): Promise<boolean> {
  const rows = await getDrizzle()
    .select({ id: members.id })
    .from(members)
    .where(exceptMemberId === undefined ? eq(members.email, email) : and(eq(members.email, email), ne(members.id, exceptMemberId)));
  return rows.length > 0;
}

export async function membershipExists(memberId: number, subscriptionId: number): Promise<boolean> {
  const rows = await getDrizzle()
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.memberId, memberId), eq(memberships.subscriptionId, subscriptionId)));
  return rows.length > 0;
}

/** Most recent reminder emails for a membership (cron milestones and manual sends). */
export async function listRemindersForMembership(membershipId: number, limit = 5) {
  return getDrizzle()
    .select({ id: reminderLog.id, kind: reminderLog.kind, dueDate: reminderLog.dueDate, sentAt: reminderLog.sentAt })
    .from(reminderLog)
    .where(eq(reminderLog.membershipId, membershipId))
    .orderBy(desc(reminderLog.sentAt))
    .limit(limit);
}
