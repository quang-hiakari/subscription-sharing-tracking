import { describe, expect, it } from 'vitest';
import { formatMoney, yearlyToMonthly } from './money';

describe('formatMoney', () => {
  it('formats JPY without decimals', () => {
    expect(formatMoney(1200, 'JPY')).toMatch(/1,200/);
    expect(formatMoney(1200, 'JPY')).not.toMatch(/\./);
  });

  it('formats VND with dot grouping and no decimals', () => {
    const out = formatMoney(50000, 'VND');
    expect(out).toMatch(/50\.000/);
    expect(out).toMatch(/₫/);
  });
});

describe('yearlyToMonthly', () => {
  it('divides evenly when it divides evenly', () => {
    expect(yearlyToMonthly(1_200_000)).toBe(100_000);
    expect(yearlyToMonthly(12_000)).toBe(1_000);
  });

  it('rounds to the nearest whole unit otherwise', () => {
    expect(yearlyToMonthly(1_000_000)).toBe(83_333); // 83333.33 -> 83333
    expect(yearlyToMonthly(1_000_010)).toBe(83_334); // 83334.17 -> 83334 (rounds up past .5)
  });
});
