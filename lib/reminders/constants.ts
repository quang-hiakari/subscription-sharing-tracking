// Days before the due date to send the first reminder when a subscription
// has no `remind_days_before` of its own.
export const DEFAULT_REMIND_DAYS_BEFORE = 7;

// After the due date: one reminder every 3 overdue days, at most 5 of them (days 3, 6, 9, 12, 15).
export const OVERDUE_INTERVAL_DAYS = 3;
export const MAX_OVERDUE_REMINDERS = 5;
