import { describe, expect, it } from 'vitest';
import { computeBulkPeriodsReference, computeSubscriptionReference } from './subscription-reference';

describe('computeSubscriptionReference', () => {
  it('splits by slotCount + 1 (the admin plus that many extra slots)', () => {
    // slotCount 3 -> 4 people total.
    expect(computeSubscriptionReference(1200, 'monthly', 3)).toEqual({
      totalPerMonth: 1200,
      totalPerYear: 14400,
      perPersonPerMonth: 300,
      perPersonPerYear: 3600,
    });
  });

  it('derives yearly totals from a yearly billing amount', () => {
    // slotCount 3 -> 4 people total.
    expect(computeSubscriptionReference(1_200_000, 'yearly', 3)).toEqual({
      totalPerMonth: 100_000,
      totalPerYear: 1_200_000,
      perPersonPerMonth: 25_000,
      perPersonPerYear: 300_000,
    });
  });

  it('rounds per-person amounts when they do not divide evenly', () => {
    // slotCount 2 -> 3 people. 1000/month -> 333.33/month, 12000/year -> 4000/year.
    expect(computeSubscriptionReference(1000, 'monthly', 2)).toEqual({
      totalPerMonth: 1000,
      totalPerYear: 12000,
      perPersonPerMonth: 333,
      perPersonPerYear: 4000,
    });
  });

  it('slotCount 0 (nobody else yet) means the admin pays the full amount', () => {
    expect(computeSubscriptionReference(900, 'monthly', 0)).toMatchObject({
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
