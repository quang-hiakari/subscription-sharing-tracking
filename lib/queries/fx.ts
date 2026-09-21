import { getDB } from '@/lib/db';
import { latestRate } from '@/lib/fx/rates';

/** Latest stored JPY -> VND rate for "≈" displays; null until the cron has fetched one. */
export function getFx() {
  return latestRate(getDB());
}
