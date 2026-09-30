import { and, count, desc, eq, ne } from 'drizzle-orm';
import { getDrizzle } from '@/lib/db';
import { members, memberships, paymentAccounts, payments, reminderLog, subscriptionPaymentAccounts, subscriptions } from '@/lib/db-schema';
import { membershipStatus } from './membership-status';

// Read helpers for the admin screens. Mutations live in each screen's actions.ts.

export async function listAccounts() {
  const db = await getDrizzle();
  return db.select().from(paymentAccounts).orderBy(paymentAccounts.currency, paymentAccounts.label);
}

export async function getAccount(id: number) {
  const db = await getDrizzle();
  const [row] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.id, id));
  return row ?? null;
}

/** A subscription's own payment accounts (it can have more than one), in a stable order. */
export async function listAccountsForSubscription(subscriptionId: number) {
  const db = await getDrizzle();
  return db
    .select({
      id: paymentAccounts.id,
      currency: paymentAccounts.currency,
      label: paymentAccounts.label,
      bankName: paymentAccounts.bankName,
      branchName: paymentAccounts.branchName,
      accountNumber: paymentAccounts.accountNumber,
      accountHolderName: paymentAccounts.accountHolderName,
      qrImagePath: paymentAccounts.qrImagePath,
    })
    .from(subscriptionPaymentAccounts)
    .innerJoin(paymentAccounts, eq(subscriptionPaymentAccounts.paymentAccountId, paymentAccounts.id))
    .where(eq(subscriptionPaymentAccounts.subscriptionId, subscriptionId))
    .orderBy(paymentAccounts.currency, paymentAccounts.label);
}

export async function listSubscriptions() {
  const db = await getDrizzle();
  const subs = await db
    .select({
      id: subscriptions.id,
      name: subscriptions.name,
      currency: subscriptions.currency,
      billingCycle: subscriptions.billingCycle,
      billingAmount: subscriptions.billingAmount,
      slotCount: subscriptions.slotCount,
      remindDaysBefore: subscriptions.remindDaysBefore,
    })
    .from(subscriptions)
    .orderBy(subscriptions.name);

  const links = await db
    .select({ subscriptionId: subscriptionPaymentAccounts.subscriptionId, label: paymentAccounts.label })
    .from(subscriptionPaymentAccounts)
    .innerJoin(paymentAccounts, eq(subscriptionPaymentAccounts.paymentAccountId, paymentAccounts.id));
  const labelsBySubscription = new Map<number, string[]>();
  for (const l of links) {
    const labels = labelsBySubscription.get(l.subscriptionId) ?? [];
    labels.push(l.label);
    labelsBySubscription.set(l.subscriptionId, labels);
  }

  return subs.map((s) => ({ ...s, accountLabels: (labelsBySubscription.get(s.id) ?? []).join(', ') }));
}

export async function getSubscription(id: number) {
  const db = await getDrizzle();
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
  return row ?? null;
}

export async function listMembers() {
  const db = await getDrizzle();
  return db.select().from(members).orderBy(members.name);
}

export async function getMember(id: number) {
  const db = await getDrizzle();
  const [row] = await db.select().from(members).where(eq(members.id, id));
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
  const db = await getDrizzle();
  return db
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
  const db = await getDrizzle();
  const [row] = await db
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
  const db = await getDrizzle();
  const taken = await db.select({ memberId: memberships.memberId }).from(memberships).where(eq(memberships.subscriptionId, subscriptionId));
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
  const db = await getDrizzle();
  const [row] = await db.select({ n: count() }).from(payments).where(eq(payments.status, 'pending'));
  return row.n;
}

// Reference counts used by delete guards.

export async function countSubscriptionsForAccount(accountId: number): Promise<number> {
  const db = await getDrizzle();
  const [row] = await db
    .select({ n: count() })
    .from(subscriptionPaymentAccounts)
    .where(eq(subscriptionPaymentAccounts.paymentAccountId, accountId));
  return row.n;
}

export async function countMembershipsForSubscription(subscriptionId: number): Promise<number> {
  const db = await getDrizzle();
  const [row] = await db.select({ n: count() }).from(memberships).where(eq(memberships.subscriptionId, subscriptionId));
  return row.n;
}

/** Active (not archived, member not archived) memberships — what actually occupies a slot. */
export async function countActiveMembershipsForSubscription(subscriptionId: number): Promise<number> {
  const db = await getDrizzle();
  const [row] = await db
    .select({ n: count() })
    .from(memberships)
    .innerJoin(members, eq(memberships.memberId, members.id))
    .where(and(eq(memberships.subscriptionId, subscriptionId), eq(memberships.archived, false), eq(members.archived, false)));
  return row.n;
}

export async function countMembershipsForMember(memberId: number): Promise<number> {
  const db = await getDrizzle();
  const [row] = await db.select({ n: count() }).from(memberships).where(eq(memberships.memberId, memberId));
  return row.n;
}

export async function countPaymentsForMembership(membershipId: number): Promise<number> {
  const db = await getDrizzle();
  const [row] = await db.select({ n: count() }).from(payments).where(eq(payments.membershipId, membershipId));
  return row.n;
}

/** True when another member already uses this email (case-insensitive: emails are stored lowercase). */
export async function emailTaken(email: string, exceptMemberId?: number): Promise<boolean> {
  const db = await getDrizzle();
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(exceptMemberId === undefined ? eq(members.email, email) : and(eq(members.email, email), ne(members.id, exceptMemberId)));
  return rows.length > 0;
}

export async function membershipExists(memberId: number, subscriptionId: number): Promise<boolean> {
  const db = await getDrizzle();
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.memberId, memberId), eq(memberships.subscriptionId, subscriptionId)));
  return rows.length > 0;
}

/** Most recent reminder emails for a membership (cron milestones and manual sends). */
export async function listRemindersForMembership(membershipId: number, limit = 5) {
  const db = await getDrizzle();
  return db
    .select({ id: reminderLog.id, kind: reminderLog.kind, dueDate: reminderLog.dueDate, sentAt: reminderLog.sentAt })
    .from(reminderLog)
    .where(eq(reminderLog.membershipId, membershipId))
    .orderBy(desc(reminderLog.sentAt))
    .limit(limit);
}
