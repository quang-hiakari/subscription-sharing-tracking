import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

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
