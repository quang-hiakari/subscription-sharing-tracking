import { describe, expect, it } from 'vitest';
import { computeBulkPeriodsReference, computeSubscriptionReference } from './subscription-reference';

describe('computeSubscriptionReference', () => {
  it('derives monthly totals from a monthly billing amount', () => {
    expect(computeSubscriptionReference(1200, 'monthly', 4)).toEqual({
      totalPerMonth: 1200,
      totalPerYear: 14400,
      perPersonPerMonth: 300,
      perPersonPerYear: 3600,
    });
  });

  it('derives yearly totals from a yearly billing amount', () => {
    expect(computeSubscriptionReference(1_200_000, 'yearly', 4)).toEqual({
      totalPerMonth: 100_000,
      totalPerYear: 1_200_000,
      perPersonPerMonth: 25_000,
      perPersonPerYear: 300_000,
    });
  });

  it('rounds per-person amounts when they do not divide evenly', () => {
    // 1000/month over 3 slots -> 333.33/month, 12000/year -> 4000/year.
    expect(computeSubscriptionReference(1000, 'monthly', 3)).toEqual({
      totalPerMonth: 1000,
      totalPerYear: 12000,
      perPersonPerMonth: 333,
      perPersonPerYear: 4000,
    });
  });

  it('defaults slotCount of 1 to per-person equal to the total', () => {
    expect(computeSubscriptionReference(900, 'monthly', 1)).toMatchObject({
      perPersonPerMonth: 900,
      perPersonPerYear: 10_800,
    });
  });
});

describe('computeBulkPeriodsReference', () => {
  it('is a plain multiple of the per-period share, no rounding needed', () => {
    expect(computeBulkPeriodsReference(300)).toEqual({ sixPeriods: 1800, twelvePeriods: 3600 });
  });

  it('handles a zero share', () => {
    expect(computeBulkPeriodsReference(0)).toEqual({ sixPeriods: 0, twelvePeriods: 0 });
  });
});
