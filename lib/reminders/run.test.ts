import { beforeEach, describe, expect, it } from 'vitest';
import type { Mail } from '../email/resend';
import { createTestD1 } from '../payments/sqlite-d1';
import { runReminders, sendManualReminder } from './run';

// "Today" is 2026-09-21 in Japan (03:00 UTC = 12:00 JST).
const NOW = new Date('2026-09-21T03:00:00Z');
const APP = 'https://app.example';

let db: D1Database;
let raw: ReturnType<typeof createTestD1>['raw'];
let mails: Mail[];
let failFor: string | null;

const send = async (mail: Mail) => {
  if (failFor && mail.to === failFor) throw new Error('Resend: boom');
  mails.push(mail);
};
const run = (now = NOW) => runReminders({ db, send, appUrl: APP, now });
const manual = (id: number, now = NOW) => sendManualReminder({ db, send, appUrl: APP, now }, id);

const logs = (where = '1=1') =>
  raw.prepare(`SELECT membership_id AS ms, due_date AS due, kind FROM reminder_log WHERE ${where} ORDER BY id`).all() as {
    ms: number;
    due: string;
    kind: string;
  }[];

// Members 1..5; subscription 1 (default lead), subscription 2 (lead 14). Add memberships per test.
beforeEach(() => {
  ({ db, raw } = createTestD1());
  mails = [];
  failFor = null;
  raw.exec(`
    INSERT INTO payment_accounts (currency, label, bank_name, branch_name, account_number, account_holder_name)
      VALUES ('JPY', 'Yucho', 'Yucho Bank', 'Main', '1234567', 'NGUYEN A');
    INSERT INTO subscriptions (name, currency, billing_amount, remind_days_before) VALUES
      ('Youtube', 'JPY', 1200, NULL), ('M365', 'JPY', 900, 14);
    INSERT INTO subscription_payment_accounts (subscription_id, payment_account_id) VALUES (1, 1), (2, 1);
    INSERT INTO members (name, email) VALUES
      ('An', 'an@x.com'), ('Binh', 'binh@x.com'), ('Chi', 'chi@x.com'), ('Dung', 'dung@x.com'), ('Em', 'em@x.com');
  `);
});

const add = (
  memberId: number,
  subscriptionId: number,
  paidThrough: string,
  over: { family?: boolean; share?: number; currency?: string } = {},
) => {
  raw.exec(
    `INSERT INTO memberships (member_id, subscription_id, currency, monthly_share, is_family, paid_through)
     VALUES (${memberId}, ${subscriptionId}, '${over.currency ?? 'JPY'}', ${over.share ?? 300}, ${over.family ? 1 : 0}, '${paidThrough}')`,
  );
};

describe('runReminders', () => {
  it('sends an upcoming reminder once and never twice for the same due date', async () => {
    add(1, 1, '2026-09-25'); // 4 days left
    expect(await run()).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe('an@x.com');
    expect(mails[0].subject).toBe('Tới hạn thanh toán tiền cho Youtube rồi bạn ơi');
    expect(mails[0].html).toContain('1234567');
    expect(mails[0].html).toContain('Yucho Bank');
    expect(mails[0].html).toContain(`${APP}/login`);
    expect(logs()).toEqual([{ ms: 1, due: '2026-09-25', kind: 't-minus' }]);

    expect(await run()).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(mails).toHaveLength(1);
  });

  it('is silent when not due, for family, and for archived memberships or members', async () => {
    add(1, 1, '2026-10-30'); // far away
    add(2, 1, '2026-09-22', { family: true });
    add(3, 1, '2026-09-22');
    raw.exec('UPDATE memberships SET archived = 1 WHERE member_id = 3');
    add(4, 1, '2026-09-22');
    raw.exec('UPDATE members SET archived = 1 WHERE id = 4');
    expect(await run()).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(mails).toHaveLength(0);
    expect(logs()).toHaveLength(0);
  });

  it("shows the amount in the member's own currency, not the subscription's", async () => {
    add(1, 1, '2026-09-25', { share: 260_000, currency: 'VND' }); // Youtube itself is billed in JPY
    await run();
    expect(mails[0].html).toMatch(/260\.000/);
    expect(mails[0].html).toContain('₫');
  });

  it('lists every payment account for the subscription, each converted to its own currency', async () => {
    raw.exec(`
      INSERT INTO payment_accounts (currency, label, bank_name, account_number, account_holder_name)
        VALUES ('VND', 'VCB', 'Vietcombank', '0123456789', 'NGUYEN A');
      INSERT INTO subscription_payment_accounts (subscription_id, payment_account_id) VALUES (1, 2);
      INSERT INTO fx_rates (date, base, quote, rate) VALUES ('2026-09-21', 'JPY', 'VND', 150);
    `);
    add(1, 1, '2026-09-25', { share: 300 }); // JPY member share, subscription 1 has a JPY and a VND account
    await run();
    expect(mails[0].html).toContain('Yucho Bank'); // native JPY account: amount unchanged
    expect(mails[0].html).toContain('Vietcombank'); // VND account: converted at the stored rate
    expect(mails[0].html).toMatch(/45,?000|45\.000/); // 300 JPY * 150 = 45,000 VND
  });

  it('shows a 6/12-month upfront reference only for a monthly-cycle subscription', async () => {
    raw.exec(`
      INSERT INTO subscriptions (name, currency, billing_cycle, billing_amount) VALUES ('Netflix', 'JPY', 'yearly', 12000);
      INSERT INTO subscription_payment_accounts (subscription_id, payment_account_id) VALUES (3, 1);
    `);
    add(1, 1, '2026-09-25', { share: 300 }); // monthly subscription
    add(2, 3, '2026-09-25', { share: 12000 }); // yearly subscription
    await run();
    const [monthlyMail, yearlyMail] = mails;
    expect(monthlyMail.html).toContain('Trả trước 6 / 12 tháng');
    expect(monthlyMail.html).toMatch(/1,?800|1\.800/); // 6 x 300
    expect(yearlyMail.html).not.toContain('Trả trước 6 / 12 tháng');
  });

  it("uses the subscription's own lead time", async () => {
    add(1, 2, '2026-10-03'); // 12 days, M365 lead = 14
    add(2, 1, '2026-10-03'); // 12 days, default lead = 7
    await run();
    expect(mails.map((m) => m.to)).toEqual(['an@x.com']);
  });

  it('walks through the full timeline for one membership: t-minus, t0, overdue 3/6/9/12/15, then stops', async () => {
    add(1, 1, '2026-09-21');
    const sentKinds: string[] = [];
    for (let offset = -7; offset <= 25; offset++) {
      const day = new Date(NOW.getTime() + offset * 86_400_000);
      const before = logs().length;
      await run(day);
      for (const l of logs().slice(before)) sentKinds.push(`${offset}:${l.kind}`);
    }
    // Today is day 0 = due date. Days are relative to the due date (offset).
    expect(sentKinds).toEqual([
      '-7:t-minus',
      '0:t0',
      '3:overdue-1',
      '6:overdue-2',
      '9:overdue-3',
      '12:overdue-4',
      '15:overdue-5',
    ]);
    expect(mails).toHaveLength(7);
  });

  it('a new due date (after a payment) starts a fresh cycle', async () => {
    add(1, 1, '2026-09-25');
    await run();
    raw.exec("UPDATE memberships SET paid_through = '2026-10-21' WHERE id = 1"); // prepaid a month
    expect(await run()).toEqual({ sent: 0, skipped: 0, failed: 0 });
    const laterNow = new Date('2026-10-16T03:00:00Z'); // 5 days before the new due date
    await run(laterNow);
    expect(logs().map((l) => `${l.due}:${l.kind}`)).toEqual(['2026-09-25:t-minus', '2026-10-21:t-minus']);
    expect(mails).toHaveLength(2);
  });

  it('does not nag while a reported payment is pending, and resumes if it is rejected', async () => {
    add(1, 1, '2026-09-25');
    raw.exec("INSERT INTO payments (membership_id, months_covered, amount, status, created_at) VALUES (1, 1, 300, 'pending', 1)");
    expect(await run()).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(logs()).toHaveLength(0);

    raw.exec("UPDATE payments SET status = 'rejected', reject_reason = 'x', decided_at = 2 WHERE id = 1");
    expect(await run()).toEqual({ sent: 1, skipped: 0, failed: 0 });
  });

  it('a failed send releases its claim, is retried next run, and does not block others', async () => {
    add(1, 1, '2026-09-25');
    add(2, 1, '2026-09-25');
    failFor = 'an@x.com';
    expect(await run()).toEqual({ sent: 1, skipped: 0, failed: 1 });
    expect(mails.map((m) => m.to)).toEqual(['binh@x.com']);
    expect(logs().map((l) => l.ms)).toEqual([2]); // An's claim removed

    failFor = null;
    expect(await run()).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(mails.map((m) => m.to)).toEqual(['binh@x.com', 'an@x.com']);
  });

  it("does not double-send after the admin's manual reminder the same JST day, but does the next day", async () => {
    add(1, 1, '2026-09-25');
    expect(await manual(1)).toEqual({ ok: true });
    expect(mails).toHaveLength(1);

    expect(await run()).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(mails).toHaveLength(1);
    expect(logs().map((l) => l.kind)).toEqual(['manual', 't-minus']);

    // The t-minus milestone was counted as done, so tomorrow does not repeat it either.
    await run(new Date(NOW.getTime() + 86_400_000));
    expect(mails).toHaveLength(1);
  });

  it('a manual reminder from yesterday does not suppress today', async () => {
    add(1, 1, '2026-09-25');
    await manual(1, new Date(NOW.getTime() - 86_400_000));
    expect(await run()).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(mails).toHaveLength(2);
  });

  it('uses the JST day, not UTC, for "today"', async () => {
    add(1, 1, '2026-09-22');
    // 2026-09-20T16:00Z is already 09-21 01:00 JST: 1 day left -> t-minus.
    await run(new Date('2026-09-20T16:00:00Z'));
    expect(mails[0].html).toContain('Còn 1 ngày đến hạn thanh toán.');
  });
});

describe('sendManualReminder', () => {
  it('sends and logs `manual`, and may be repeated', async () => {
    add(1, 1, '2026-09-19'); // 2 days overdue: no cron kind yet, admin can still nudge
    expect(await manual(1)).toEqual({ ok: true });
    expect(await manual(1)).toEqual({ ok: true });
    expect(mails).toHaveLength(2);
    expect(mails[0].subject).toBe('Tới hạn thanh toán tiền cho Youtube rồi bạn ơi');
    expect(mails[0].html).toContain('Đã quá hạn thanh toán 2 ngày.');
    expect(logs().map((l) => l.kind)).toEqual(['manual', 'manual']);
  });

  it('refuses family, archived and unknown memberships without sending', async () => {
    add(1, 1, '2026-09-25', { family: true });
    add(2, 1, '2026-09-25');
    raw.exec('UPDATE memberships SET archived = 1 WHERE id = 2');
    add(3, 1, '2026-09-25');
    raw.exec('UPDATE members SET archived = 1 WHERE id = 3');
    expect((await manual(1)).ok).toBe(false);
    expect((await manual(2)).ok).toBe(false);
    expect((await manual(3)).ok).toBe(false);
    expect((await manual(999)).ok).toBe(false);
    expect(mails).toHaveLength(0);
    expect(logs()).toHaveLength(0);
  });

  it('reports a send failure and logs nothing', async () => {
    add(1, 1, '2026-09-25');
    failFor = 'an@x.com';
    expect(await manual(1)).toEqual({ ok: false, error: 'Resend: boom' });
    expect(logs()).toHaveLength(0);
  });
});
