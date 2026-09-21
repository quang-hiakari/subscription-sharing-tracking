import { daysBetween } from '@/lib/format/date';
import { DEFAULT_REMIND_DAYS_BEFORE } from '@/lib/reminders/constants';

export type MembershipStatus = 'family' | 'ok' | 'due_soon' | 'overdue';

export interface StatusInput {
  isFamily: boolean;
  /** Next due date, 'YYYY-MM-DD'. */
  paidThrough: string;
  /** Subscription's lead time; null uses the default. */
  remindDaysBefore: number | null;
}

/**
 * `daysUntilDue` is negative once overdue. Due today counts as due_soon, and
 * family members are never owing anything.
 */
export function membershipStatus(
  m: StatusInput,
  today: string,
): { status: MembershipStatus; daysUntilDue: number } {
  const daysUntilDue = daysBetween(today, m.paidThrough);
  if (m.isFamily) return { status: 'family', daysUntilDue };
  if (daysUntilDue < 0) return { status: 'overdue', daysUntilDue };
  const leadDays = m.remindDaysBefore ?? DEFAULT_REMIND_DAYS_BEFORE;
  return { status: daysUntilDue <= leadDays ? 'due_soon' : 'ok', daysUntilDue };
}
