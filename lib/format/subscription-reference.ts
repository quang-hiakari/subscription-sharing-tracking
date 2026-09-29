import type { BillingCycle } from '../db-schema';
import { yearlyToMonthly } from './money';

export interface SubscriptionReference {
  totalPerMonth: number;
  totalPerYear: number;
  perPersonPerMonth: number;
  perPersonPerYear: number;
}

/**
 * Display-only reference numbers for a subscription: what it (and one share of it) costs per
 * month and per year, derived from whatever the admin actually entered (amount + cycle) —
 * never stored, never fed back into the amount fields.
 */
export function computeSubscriptionReference(
  billingAmount: number,
  billingCycle: BillingCycle,
  slotCount: number,
): SubscriptionReference {
  const totalPerMonth = billingCycle === 'monthly' ? billingAmount : yearlyToMonthly(billingAmount);
  const totalPerYear = billingCycle === 'yearly' ? billingAmount : billingAmount * 12;
  return {
    totalPerMonth,
    totalPerYear,
    perPersonPerMonth: Math.round(totalPerMonth / slotCount),
    perPersonPerYear: Math.round(totalPerYear / slotCount),
  };
}
