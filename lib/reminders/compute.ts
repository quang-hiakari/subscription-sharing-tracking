import type { ReminderKind } from '../db-schema';
import { daysBetween } from '../format/date';
import { DEFAULT_REMIND_DAYS_BEFORE, MAX_OVERDUE_REMINDERS, OVERDUE_INTERVAL_DAYS } from './constants';

// Pure reminder rules. Relative imports only: the cron Worker bundles this file too.

export interface ReminderTarget {
  isFamily: boolean;
  /** Next due date, 'YYYY-MM-DD'. */
  paidThrough: string;
  /** Subscription's lead time; null uses the default. */
  remindDaysBefore: number | null;
}

/**
 * Which reminder is owed today, or null. Each kind is logged once per due date, so a kind
 * that stays eligible across several days (or after a missed cron run) is still sent once.
 *   - 't-minus': within the lead time before the due date
 *   - 't0': on the due date
 *   - 'overdue-k': from the 3rd overdue day, then every 3 days, capped at MAX_OVERDUE_REMINDERS
 */
export function dueReminderKind(target: ReminderTarget, today: string): ReminderKind | null {
  if (target.isFamily) return null;

  const daysUntilDue = daysBetween(today, target.paidThrough);
  const leadDays = target.remindDaysBefore ?? DEFAULT_REMIND_DAYS_BEFORE;

  if (daysUntilDue > leadDays) return null;
  if (daysUntilDue > 0) return 't-minus';
  if (daysUntilDue === 0) return 't0';

  const overdueIndex = Math.min(MAX_OVERDUE_REMINDERS, Math.floor(-daysUntilDue / OVERDUE_INTERVAL_DAYS));
  return overdueIndex >= 1 ? (`overdue-${overdueIndex}` as ReminderKind) : null;
}
