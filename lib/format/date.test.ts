import { describe, expect, it } from 'vitest';
import { addMonths, daysBetween, isValidDate, todayJst } from './date';

describe('isValidDate', () => {
  it('accepts real dates including leap day', () => {
    expect(isValidDate('2026-09-21')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
  });

  it('rejects impossible or malformed dates', () => {
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2026-00-10')).toBe(false);
    expect(isValidDate('2026-9-1')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});

describe('addMonths', () => {
  it('adds plain months', () => {
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonths('2026-01-15', 12)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', 6)).toBe('2026-07-15');
  });

  it('clamps to month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('crosses year boundaries', () => {
    expect(addMonths('2026-11-10', 3)).toBe('2027-02-10');
    expect(addMonths('2026-12-31', 2)).toBe('2027-02-28');
  });

  it('rejects malformed dates', () => {
    expect(() => addMonths('2026-1-5', 1)).toThrow();
  });
});

describe('daysBetween', () => {
  it('counts signed whole days', () => {
    expect(daysBetween('2026-09-21', '2026-09-28')).toBe(7);
    expect(daysBetween('2026-09-28', '2026-09-21')).toBe(-7);
    expect(daysBetween('2026-09-21', '2026-09-21')).toBe(0);
  });

  it('handles month and leap-year spans', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('todayJst', () => {
  it('uses the JST calendar day, not UTC', () => {
    // 2026-09-20 16:00 UTC is already 2026-09-21 01:00 in Tokyo.
    expect(todayJst(new Date('2026-09-20T16:00:00Z'))).toBe('2026-09-21');
    // 2026-09-20 14:59 UTC is still 2026-09-20 23:59 in Tokyo.
    expect(todayJst(new Date('2026-09-20T14:59:00Z'))).toBe('2026-09-20');
  });
});
