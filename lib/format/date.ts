// Pure date helpers on 'YYYY-MM-DD' strings. No Next/Cloudflare imports: the
// reminder Worker imports this file too.

const JST_TIME_ZONE = 'Asia/Tokyo';
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parse(date: string): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Today's calendar date in Japan (the app's canonical timezone). */
export function todayJst(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Add whole months, clamping to month end (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(date: string, months: number): string {
  const { y, m, d } = parse(date);
  const zeroBased = y * 12 + (m - 1) + months;
  const targetY = Math.floor(zeroBased / 12);
  const targetM = (zeroBased % 12 + 12) % 12 + 1;
  const day = Math.min(d, daysInMonth(targetY, targetM));
  return `${pad(targetY, 4)}-${pad(targetM)}-${pad(day)}`;
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const a = parse(from);
  const b = parse(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** True for a real calendar date in 'YYYY-MM-DD' form (rejects 2026-02-30). */
export function isValidDate(date: string): boolean {
  const match = DATE_RE.exec(date);
  if (!match) return false;
  const { y, m, d } = parse(date);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}
