import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestD1 } from '../payments/sqlite-d1';
import { convertToOther, otherCurrency, sumByCurrency, totalInVnd } from './convert';
import { fetchJpyToVnd, latestRate, refreshFxRate } from './rates';

afterEach(() => vi.unstubAllGlobals());

const respond = (body: unknown, status = 200) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));

describe('convert', () => {
  it('converts both directions and rounds to whole units', () => {
    expect(convertToOther(300, 'JPY', 165.4)).toBe(49620);
    expect(convertToOther(100_000, 'VND', 165.4)).toBe(605); // 604.6 -> 605
    expect(convertToOther(0, 'JPY', 165.4)).toBe(0);
  });

  it('otherCurrency flips', () => {
    expect(otherCurrency('JPY')).toBe('VND');
    expect(otherCurrency('VND')).toBe('JPY');
  });

  it('sums per currency and totals in VND', () => {
    const sums = sumByCurrency([
      { currency: 'JPY', amount: 300 },
      { currency: 'JPY', amount: 200 },
      { currency: 'VND', amount: 100_000 },
    ]);
    expect(sums).toEqual({ JPY: 500, VND: 100_000 });
    expect(totalInVnd(sums, 165)).toBe(182_500);
    expect(sumByCurrency([])).toEqual({ JPY: 0, VND: 0 });
  });
});

describe('fetchJpyToVnd', () => {
  it('returns the VND rate on success', async () => {
    respond({ result: 'success', rates: { VND: 165.4, USD: 0.0067 } });
    expect(await fetchJpyToVnd()).toBe(165.4);
  });

  it('rejects a non-success result, missing VND, junk values and HTTP errors', async () => {
    respond({ result: 'error', 'error-type': 'quota-reached' });
    await expect(fetchJpyToVnd()).rejects.toThrow('FX: unexpected response');
    respond({ result: 'success', rates: { USD: 1 } });
    await expect(fetchJpyToVnd()).rejects.toThrow('FX: unexpected response');
    respond({ result: 'success', rates: { VND: 0 } });
    await expect(fetchJpyToVnd()).rejects.toThrow('FX: unexpected response');
    respond({ result: 'success', rates: { VND: '165' } });
    await expect(fetchJpyToVnd()).rejects.toThrow('FX: unexpected response');
    respond({}, 503);
    await expect(fetchJpyToVnd()).rejects.toThrow('FX: HTTP 503');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })));
    await expect(fetchJpyToVnd()).rejects.toThrow('FX: unexpected response');
  });
});

describe('rate storage', () => {
  const day1 = new Date('2026-09-21T03:00:00Z');
  const day2 = new Date('2026-09-22T03:00:00Z');

  it('has no rate before the first fetch', async () => {
    const { db } = createTestD1();
    expect(await latestRate(db)).toBeNull();
  });

  it('stores one row per day (same-day rerun overwrites) and returns the latest', async () => {
    const { db, raw } = createTestD1();
    respond({ result: 'success', rates: { VND: 165 } });
    expect(await refreshFxRate(db, day1)).toEqual({ rate: 165, date: '2026-09-21' });
    respond({ result: 'success', rates: { VND: 166 } });
    await refreshFxRate(db, day1);
    expect(raw.prepare('SELECT count(*) AS n FROM fx_rates').get()).toEqual({ n: 1 });
    expect(await latestRate(db)).toEqual({ rate: 166, date: '2026-09-21' });

    respond({ result: 'success', rates: { VND: 167 } });
    await refreshFxRate(db, day2);
    expect(await latestRate(db)).toEqual({ rate: 167, date: '2026-09-22' });
  });

  it('keeps the previous rate when a fetch fails', async () => {
    const { db } = createTestD1();
    respond({ result: 'success', rates: { VND: 165 } });
    await refreshFxRate(db, day1);
    respond({}, 500);
    await expect(refreshFxRate(db, day2)).rejects.toThrow('FX: HTTP 500');
    expect(await latestRate(db)).toEqual({ rate: 165, date: '2026-09-21' });
  });
});
