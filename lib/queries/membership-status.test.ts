import { describe, expect, it } from 'vitest';
import { membershipStatus } from './membership-status';

const today = '2026-09-21';
const base = { isFamily: false, remindDaysBefore: null as number | null };

describe('membershipStatus', () => {
  it('is ok when due is beyond the default 7 days', () => {
    expect(membershipStatus({ ...base, paidThrough: '2026-09-29' }, today)).toEqual({ status: 'ok', daysUntilDue: 8 });
  });

  it('is due_soon exactly at the lead time boundary', () => {
    expect(membershipStatus({ ...base, paidThrough: '2026-09-28' }, today).status).toBe('due_soon');
  });

  it('is due_soon on the due date itself', () => {
    expect(membershipStatus({ ...base, paidThrough: today }, today)).toEqual({ status: 'due_soon', daysUntilDue: 0 });
  });

  it('is overdue the day after the due date', () => {
    expect(membershipStatus({ ...base, paidThrough: '2026-09-20' }, today)).toEqual({ status: 'overdue', daysUntilDue: -1 });
  });

  it('uses the subscription lead time when set', () => {
    const m = { ...base, remindDaysBefore: 14, paidThrough: '2026-10-05' };
    expect(membershipStatus(m, today).status).toBe('due_soon');
    expect(membershipStatus({ ...m, remindDaysBefore: 3 }, today).status).toBe('ok');
  });

  it('lead time 0 only flags the due date', () => {
    const m = { ...base, remindDaysBefore: 0 };
    expect(membershipStatus({ ...m, paidThrough: '2026-09-22' }, today).status).toBe('ok');
    expect(membershipStatus({ ...m, paidThrough: today }, today).status).toBe('due_soon');
  });

  it('family is never overdue or due soon', () => {
    expect(membershipStatus({ ...base, isFamily: true, paidThrough: '2020-01-01' }, today).status).toBe('family');
    expect(membershipStatus({ ...base, isFamily: true, paidThrough: today }, today).status).toBe('family');
  });

  it('crosses month and year boundaries', () => {
    expect(membershipStatus({ ...base, paidThrough: '2027-01-01' }, '2026-12-31').daysUntilDue).toBe(1);
  });
});
