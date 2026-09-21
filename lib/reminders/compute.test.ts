import { describe, expect, it } from 'vitest';
import { dueReminderKind } from './compute';

const today = '2026-09-21';
const target = (paidThrough: string, over: Partial<{ isFamily: boolean; remindDaysBefore: number | null }> = {}) => ({
  isFamily: false,
  remindDaysBefore: null,
  paidThrough,
  ...over,
});

// Due-date offsets from `today`: 2026-09-21 + N days.
const due = {
  in8: '2026-09-29',
  in7: '2026-09-28',
  in1: '2026-09-22',
  today: '2026-09-21',
  ago1: '2026-09-20',
  ago2: '2026-09-19',
  ago3: '2026-09-18',
  ago5: '2026-09-16',
  ago6: '2026-09-15',
  ago15: '2026-09-06',
  ago17: '2026-09-04',
  ago40: '2026-08-12',
};

describe('dueReminderKind', () => {
  it('is silent before the lead time', () => {
    expect(dueReminderKind(target(due.in8), today)).toBeNull();
  });

  it('starts at the default 7-day lead time and stays eligible until the due date', () => {
    expect(dueReminderKind(target(due.in7), today)).toBe('t-minus');
    expect(dueReminderKind(target(due.in1), today)).toBe('t-minus');
  });

  it('sends t0 on the due date', () => {
    expect(dueReminderKind(target(due.today), today)).toBe('t0');
  });

  it('is silent for the first two overdue days', () => {
    expect(dueReminderKind(target(due.ago1), today)).toBeNull();
    expect(dueReminderKind(target(due.ago2), today)).toBeNull();
  });

  it('sends overdue-k every 3 days', () => {
    expect(dueReminderKind(target(due.ago3), today)).toBe('overdue-1');
    expect(dueReminderKind(target(due.ago5), today)).toBe('overdue-1');
    expect(dueReminderKind(target(due.ago6), today)).toBe('overdue-2');
  });

  it('caps at 5 overdue reminders (kind stays overdue-5 so it is never sent again)', () => {
    expect(dueReminderKind(target(due.ago15), today)).toBe('overdue-5');
    expect(dueReminderKind(target(due.ago17), today)).toBe('overdue-5');
    expect(dueReminderKind(target(due.ago40), today)).toBe('overdue-5');
  });

  it('honours a custom lead time', () => {
    expect(dueReminderKind(target(due.in8, { remindDaysBefore: 14 }), today)).toBe('t-minus');
    expect(dueReminderKind(target(due.in7, { remindDaysBefore: 3 }), today)).toBeNull();
    expect(dueReminderKind(target('2026-09-24', { remindDaysBefore: 3 }), today)).toBe('t-minus');
  });

  it('lead time 0 only reminds on the due date', () => {
    expect(dueReminderKind(target(due.in1, { remindDaysBefore: 0 }), today)).toBeNull();
    expect(dueReminderKind(target(due.today, { remindDaysBefore: 0 }), today)).toBe('t0');
  });

  it('never reminds family members', () => {
    for (const d of Object.values(due)) expect(dueReminderKind(target(d, { isFamily: true }), today)).toBeNull();
  });

  it('a prepaid far-future due date is silent', () => {
    expect(dueReminderKind(target('2027-09-21'), today)).toBeNull();
  });
});
