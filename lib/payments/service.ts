import { addMonths } from '@/lib/format/date';

// Payment lifecycle. Money and dates live here so the rules are in one place:
//   - a member reports a payment (pending), an admin approves or rejects it;
//   - approving moves `memberships.paid_through` forward by `months_covered`;
//   - an admin can also record a payment directly (born approved).
// Every state change is one D1 batch (a SQL transaction) guarded by compare-and-swap
// conditions, so a double click, a retry or a concurrent edit can never move the date twice.

export const MAX_MONTHS_PER_PAYMENT = 36;

export type ServiceResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ServiceResult => ({ ok: false, error });

interface MembershipRow {
  id: number;
  member_id: number;
  monthly_share: number;
  is_family: number;
  paid_through: string;
  archived: number;
  member_archived: number;
  billing_cycle: 'monthly' | 'yearly';
}

async function loadMembership(db: D1Database, id: number): Promise<MembershipRow | null> {
  return db
    .prepare(
      `SELECT ms.id, ms.member_id, ms.monthly_share, ms.is_family, ms.paid_through, ms.archived,
              m.archived AS member_archived, s.billing_cycle
       FROM memberships ms
       JOIN members m ON m.id = ms.member_id
       JOIN subscriptions s ON s.id = ms.subscription_id
       WHERE ms.id = ?`,
    )
    .bind(id)
    .first<MembershipRow>();
}

/** Amount defaults to share-per-cycle x periods when the user leaves it empty. */
function resolveAmount(row: MembershipRow, periods: number, amount: number | null): number {
  return amount ?? row.monthly_share * periods;
}

/**
 * Calendar months to advance `paid_through` for N paid periods: a "period" is one of the
 * subscription's own billing cycles, so a yearly subscription moves the date by 12 months
 * per period paid. `addMonths` itself only ever deals in months — this is the one place a
 * "period" is translated into "how many calendar months that period actually is".
 */
function periodsToMonths(periods: number, billingCycle: 'monthly' | 'yearly'): number {
  return billingCycle === 'yearly' ? periods * 12 : periods;
}

export interface PaymentInput {
  membershipId: number;
  monthsCovered: number;
  /** Null means "monthly share x months". */
  amount: number | null;
  note: string | null;
}

/** A member reports that they paid. Creates a pending payment. */
export async function createPaymentRequest(
  db: D1Database,
  memberId: number,
  input: PaymentInput,
  now: Date,
): Promise<ServiceResult> {
  const row = await loadMembership(db, input.membershipId);
  // Same message for "missing" and "someone else's" so ids cannot be probed.
  if (!row || row.member_id !== memberId || row.archived || row.member_archived) {
    return fail('Không tìm thấy subscription này.');
  }
  if (row.is_family) return fail('Người nhà không cần thanh toán.');

  const amount = resolveAmount(row, input.monthsCovered, input.amount);
  if (amount <= 0) return fail('Số tiền phải lớn hơn 0.');

  try {
    await db
      .prepare(
        `INSERT INTO payments (membership_id, months_covered, amount, status, note, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?)`,
      )
      .bind(row.id, input.monthsCovered, amount, input.note, now.getTime())
      .run();
  } catch (err) {
    // payments_one_pending_uq
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return fail('Bạn đã báo thanh toán và đang chờ xác nhận.');
    }
    throw err;
  }
  return { ok: true };
}

/** Admin approves a pending payment and moves the due date forward, atomically. */
export async function approvePayment(db: D1Database, paymentId: number, now: Date): Promise<ServiceResult> {
  const payment = await db
    .prepare('SELECT id, membership_id, months_covered, status FROM payments WHERE id = ?')
    .bind(paymentId)
    .first<{ id: number; membership_id: number; months_covered: number; status: string }>();
  if (!payment) return fail('Không tìm thấy thanh toán.');
  if (payment.status !== 'pending') return fail('Thanh toán này đã được xử lý.');

  const membership = await loadMembership(db, payment.membership_id);
  if (!membership) return fail('Không tìm thấy subscription của thanh toán này.');

  const oldDue = membership.paid_through;
  const newDue = addMonths(oldDue, periodsToMonths(payment.months_covered, membership.billing_cycle));
  const decidedAt = now.getTime();

  // Statement 1 approves only while the payment is pending AND the due date is still what we read.
  // Statement 2 moves the date only if statement 1 took effect (same decided_at) and the date is unchanged.
  // Either both apply or neither does.
  const [approved] = await db.batch([
    db
      .prepare(
        `UPDATE payments SET status = 'approved', decided_at = ?
         WHERE id = ? AND status = 'pending'
           AND EXISTS (SELECT 1 FROM memberships WHERE id = ? AND paid_through = ?)`,
      )
      .bind(decidedAt, paymentId, payment.membership_id, oldDue),
    db
      .prepare(
        `UPDATE memberships SET paid_through = ?
         WHERE id = ? AND paid_through = ?
           AND EXISTS (SELECT 1 FROM payments WHERE id = ? AND status = 'approved' AND decided_at = ?)`,
      )
      .bind(newDue, payment.membership_id, oldDue, paymentId, decidedAt),
  ]);
  if (approved.meta.changes !== 1) {
    return fail('Thanh toán vừa được xử lý hoặc hạn thanh toán vừa thay đổi. Hãy tải lại trang.');
  }
  return { ok: true };
}

export async function rejectPayment(
  db: D1Database,
  paymentId: number,
  reason: string,
  now: Date,
): Promise<ServiceResult> {
  const result = await db
    .prepare(
      `UPDATE payments SET status = 'rejected', reject_reason = ?, decided_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .bind(reason, now.getTime(), paymentId)
    .run();
  if (result.meta.changes !== 1) return fail('Thanh toán này đã được xử lý hoặc không tồn tại.');
  return { ok: true };
}

/** Admin records a payment they received directly: created approved, due date moves in the same transaction. */
export async function recordPayment(db: D1Database, input: PaymentInput, now: Date): Promise<ServiceResult> {
  const row = await loadMembership(db, input.membershipId);
  if (!row) return fail('Không tìm thấy subscription.');
  if (row.is_family) return fail('Người nhà không cần thanh toán.');

  const amount = resolveAmount(row, input.monthsCovered, input.amount);
  if (amount <= 0) return fail('Số tiền phải lớn hơn 0.');

  const oldDue = row.paid_through;
  const newDue = addMonths(oldDue, periodsToMonths(input.monthsCovered, row.billing_cycle));
  const at = now.getTime();

  const [inserted] = await db.batch([
    db
      .prepare(
        `INSERT INTO payments (membership_id, months_covered, amount, status, note, created_at, decided_at)
         SELECT ?, ?, ?, 'approved', ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM memberships WHERE id = ? AND paid_through = ?)`,
      )
      .bind(row.id, input.monthsCovered, amount, input.note, at, at, row.id, oldDue),
    db
      .prepare(
        `UPDATE memberships SET paid_through = ?
         WHERE id = ? AND paid_through = ?
           AND EXISTS (SELECT 1 FROM payments WHERE membership_id = ? AND status = 'approved' AND decided_at = ?)`,
      )
      .bind(newDue, row.id, oldDue, row.id, at),
  ]);
  if (inserted.meta.changes !== 1) {
    return fail('Hạn thanh toán vừa thay đổi. Hãy tải lại trang và thử lại.');
  }
  return { ok: true };
}
