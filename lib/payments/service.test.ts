import { beforeEach, describe, expect, it } from 'vitest';
import { approvePayment, createPaymentRequest, recordPayment, rejectPayment } from './service';
import { createTestD1 } from './sqlite-d1';

const NOW = new Date('2026-09-21T03:00:00Z');

let db: D1Database;
let raw: ReturnType<typeof createTestD1>['raw'];

// Members 1 (An) and 2 (Binh); subscription 1 (share 300); memberships: 1 = An, 2 = Binh, 3 = An (family).
beforeEach(() => {
  ({ db, raw } = createTestD1());
  raw.exec(`
    INSERT INTO payment_accounts (currency, label, details) VALUES ('JPY', 'Yucho', '123');
    INSERT INTO subscriptions (name, currency, price_per_month, payment_account_id) VALUES ('Youtube', 'JPY', 1200, 1), ('M365', 'JPY', 900, 1);
    INSERT INTO members (name, email) VALUES ('An', 'an@x.com'), ('Binh', 'binh@x.com');
    INSERT INTO memberships (member_id, subscription_id, monthly_share, is_family, paid_through) VALUES
      (1, 1, 300, 0, '2026-10-01'),
      (2, 1, 300, 0, '2026-09-01'),
      (1, 2, 0, 1, '2026-09-01');
  `);
});

const paidThrough = (id: number) =>
  (raw.prepare('SELECT paid_through AS d FROM memberships WHERE id = ?').get(id) as { d: string }).d;
const payment = (id: number) =>
  raw.prepare('SELECT * FROM payments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
const request = (memberId: number, membershipId: number, over: Partial<{ monthsCovered: number; amount: number | null }> = {}) =>
  createPaymentRequest(db, memberId, { membershipId, monthsCovered: 1, amount: null, note: null, ...over }, NOW);

describe('createPaymentRequest', () => {
  it('creates a pending payment with amount = share x months by default', async () => {
    expect(await request(1, 1, { monthsCovered: 6 })).toEqual({ ok: true });
    expect(payment(1)).toMatchObject({ membership_id: 1, months_covered: 6, amount: 1800, status: 'pending', decided_at: null });
    expect(paidThrough(1)).toBe('2026-10-01'); // date does not move until approved
  });

  it('keeps an explicit amount', async () => {
    await request(1, 1, { monthsCovered: 12, amount: 3000 });
    expect(payment(1)).toMatchObject({ amount: 3000 });
  });

  it('allows only one pending request per membership, again after a decision', async () => {
    expect(await request(1, 1)).toEqual({ ok: true });
    expect(await request(1, 1)).toEqual({ ok: false, error: 'Bạn đã báo thanh toán và đang chờ xác nhận.' });
    await rejectPayment(db, 1, 'sai số tiền', NOW);
    expect(await request(1, 1)).toEqual({ ok: true });
  });

  it("refuses another member's membership without revealing it exists", async () => {
    const other = await request(2, 1);
    const missing = await request(2, 999);
    expect(other).toEqual(missing);
    expect(other.ok).toBe(false);
    expect(payment(1)).toBeUndefined();
  });

  it('refuses family memberships', async () => {
    expect(await request(1, 3)).toEqual({ ok: false, error: 'Người nhà không cần thanh toán.' });
  });

  it('refuses archived memberships and archived members', async () => {
    raw.exec('UPDATE memberships SET archived = 1 WHERE id = 1');
    expect((await request(1, 1)).ok).toBe(false);
    raw.exec('UPDATE memberships SET archived = 0 WHERE id = 1; UPDATE members SET archived = 1 WHERE id = 1');
    expect((await request(1, 1)).ok).toBe(false);
  });

  it('refuses a zero amount', async () => {
    raw.exec('UPDATE memberships SET monthly_share = 0 WHERE id = 1');
    expect(await request(1, 1)).toEqual({ ok: false, error: 'Số tiền phải lớn hơn 0.' });
  });
});

describe('approvePayment', () => {
  it('approves and moves the due date by the months covered', async () => {
    await request(1, 1, { monthsCovered: 12 });
    expect(await approvePayment(db, 1, NOW)).toEqual({ ok: true });
    expect(paidThrough(1)).toBe('2027-10-01');
    expect(payment(1)).toMatchObject({ status: 'approved', decided_at: NOW.getTime() });
  });

  it('moves from the old due date even when overdue', async () => {
    await request(2, 2, { monthsCovered: 1 }); // due 2026-09-01, today 2026-09-21
    await approvePayment(db, 1, NOW);
    expect(paidThrough(2)).toBe('2026-10-01');
  });

  it('clamps month ends', async () => {
    raw.exec("UPDATE memberships SET paid_through = '2026-01-31' WHERE id = 1");
    await request(1, 1, { monthsCovered: 1 });
    await approvePayment(db, 1, NOW);
    expect(paidThrough(1)).toBe('2026-02-28');
  });

  it('is idempotent: a second approval is refused and the date moves once', async () => {
    await request(1, 1, { monthsCovered: 3 });
    expect(await approvePayment(db, 1, NOW)).toEqual({ ok: true });
    expect(await approvePayment(db, 1, NOW)).toEqual({ ok: false, error: 'Thanh toán này đã được xử lý.' });
    expect(paidThrough(1)).toBe('2027-01-01');
  });

  it('two concurrent approvals move the date exactly once', async () => {
    await request(1, 1, { monthsCovered: 3 });
    const results = await Promise.all([approvePayment(db, 1, NOW), approvePayment(db, 1, NOW)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(paidThrough(1)).toBe('2027-01-01');
  });

  it('does not approve when the due date changed since it was read (compare-and-swap)', async () => {
    await request(1, 1, { monthsCovered: 1 });
    // Simulate an admin edit landing between the read and the batch.
    const realPrepare = db.prepare.bind(db);
    let edited = false;
    db.prepare = ((sql: string) => {
      const statement = realPrepare(sql);
      if (!edited && sql.includes("SET status = 'approved'")) {
        edited = true;
        raw.exec("UPDATE memberships SET paid_through = '2026-12-25' WHERE id = 1");
      }
      return statement;
    }) as typeof db.prepare;

    const result = await approvePayment(db, 1, NOW);
    expect(result.ok).toBe(false);
    expect(payment(1)).toMatchObject({ status: 'pending' });
    expect(paidThrough(1)).toBe('2026-12-25');
  });

  it('cannot approve a rejected or missing payment', async () => {
    await request(1, 1);
    await rejectPayment(db, 1, 'x', NOW);
    expect((await approvePayment(db, 1, NOW)).ok).toBe(false);
    expect(await approvePayment(db, 999, NOW)).toEqual({ ok: false, error: 'Không tìm thấy thanh toán.' });
    expect(paidThrough(1)).toBe('2026-10-01');
  });
});

describe('rejectPayment', () => {
  it('stores the reason and leaves the due date alone', async () => {
    await request(1, 1, { monthsCovered: 6 });
    expect(await rejectPayment(db, 1, 'chưa nhận được tiền', NOW)).toEqual({ ok: true });
    expect(payment(1)).toMatchObject({ status: 'rejected', reject_reason: 'chưa nhận được tiền', decided_at: NOW.getTime() });
    expect(paidThrough(1)).toBe('2026-10-01');
  });

  it('only works on pending payments', async () => {
    await request(1, 1);
    await approvePayment(db, 1, NOW);
    expect((await rejectPayment(db, 1, 'x', NOW)).ok).toBe(false);
    expect(payment(1)).toMatchObject({ status: 'approved' });
    expect((await rejectPayment(db, 999, 'x', NOW)).ok).toBe(false);
  });
});

describe('recordPayment', () => {
  const record = (membershipId: number, over: Partial<{ monthsCovered: number; amount: number | null }> = {}) =>
    recordPayment(db, { membershipId, monthsCovered: 1, amount: null, note: 'tiền mặt', ...over }, NOW);

  it('creates an approved payment and moves the due date together', async () => {
    expect(await record(1, { monthsCovered: 6 })).toEqual({ ok: true });
    expect(payment(1)).toMatchObject({ status: 'approved', months_covered: 6, amount: 1800, note: 'tiền mặt', decided_at: NOW.getTime() });
    expect(paidThrough(1)).toBe('2027-04-01');
  });

  it('refuses family and unknown memberships without writing anything', async () => {
    expect((await record(3)).ok).toBe(false);
    expect((await record(999)).ok).toBe(false);
    expect(payment(1)).toBeUndefined();
  });

  it('refuses a non-positive amount and writes nothing', async () => {
    expect(await record(1, { amount: -5 })).toEqual({ ok: false, error: 'Số tiền phải lớn hơn 0.' });
    expect(payment(1)).toBeUndefined();
    expect(paidThrough(1)).toBe('2026-10-01');
  });

  it('rolls the whole batch back when a statement fails', async () => {
    // Force the second statement (date update) to fail: the already-executed insert must be undone.
    raw.exec(`CREATE TRIGGER fail_date BEFORE UPDATE OF paid_through ON memberships BEGIN SELECT RAISE(ABORT, 'boom'); END`);
    await expect(record(1)).rejects.toThrow('boom');
    expect(payment(1)).toBeUndefined();
    expect(paidThrough(1)).toBe('2026-10-01');
  });
});
