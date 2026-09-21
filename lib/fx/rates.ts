import { todayJst } from '../format/date';

// Daily JPY -> VND rate: fetched by the cron Worker, stored in `fx_rates`, read by the app.
// Source: open.er-api.com (free, no key, updates daily, includes VND; the ECB feed has no VND).
// Its terms require attribution, shown by the FxNote component. Relative imports only (Worker bundles this).

const SOURCE_URL = 'https://open.er-api.com/v6/latest/JPY';

export interface FxRate {
  /** VND per 1 JPY. */
  rate: number;
  /** Day the rate was fetched, 'YYYY-MM-DD' (JST). */
  date: string;
}

export async function fetchJpyToVnd(): Promise<number> {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`FX: HTTP ${response.status}`);

  const body = (await response.json().catch(() => null)) as { result?: string; rates?: Record<string, unknown> } | null;
  const rate = body?.rates?.VND;
  if (body?.result !== 'success' || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error('FX: unexpected response');
  }
  return rate;
}

/** Fetches today's rate and stores it (a second run the same day overwrites it). Throws if the fetch fails; older rows stay. */
export async function refreshFxRate(db: D1Database, now: Date): Promise<FxRate> {
  const rate = await fetchJpyToVnd();
  const date = todayJst(now);
  await db
    .prepare(
      `INSERT INTO fx_rates (date, base, quote, rate) VALUES (?, 'JPY', 'VND', ?)
       ON CONFLICT (date, base, quote) DO UPDATE SET rate = excluded.rate`,
    )
    .bind(date, rate)
    .run();
  return { rate, date };
}

/** Most recent stored rate, or null when none has been fetched yet. */
export async function latestRate(db: D1Database): Promise<FxRate | null> {
  return db
    .prepare("SELECT rate, date FROM fx_rates WHERE base = 'JPY' AND quote = 'VND' ORDER BY date DESC LIMIT 1")
    .first<FxRate>();
}
