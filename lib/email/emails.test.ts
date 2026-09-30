import { describe, expect, it } from 'vitest';
import { buildPaymentRejectedEmail, buildPaymentSubmittedEmail } from './payment-emails';
import { buildReminderEmail } from './reminder-email';

const base = {
  memberName: 'An',
  subscriptionName: 'Youtube',
  currency: 'JPY' as const,
  monthlyShare: 300,
  dueDate: '2026-10-01',
  accountDetails: 'Ngân hàng: Yucho\nSố tài khoản: 1234567\nChủ tài khoản: Nguyen A',
  appUrl: 'https://app.example',
  bulkReference: null,
};

describe('buildReminderEmail', () => {
  it('upcoming: countdown in subject, due date, amount, account and login link', () => {
    const { subject, html } = buildReminderEmail({ ...base, daysUntilDue: 5 });
    expect(subject).toBe('Sắp đến hạn thanh toán Youtube: còn 5 ngày');
    expect(html).toContain('2026-10-01');
    expect(html).toContain('300');
    expect(html).toContain('Ngân hàng: Yucho<br>Số tài khoản: 1234567<br>Chủ tài khoản: Nguyen A');
    expect(html).toContain('https://app.example/login');
  });

  it('due today and overdue subjects', () => {
    expect(buildReminderEmail({ ...base, daysUntilDue: 0 }).subject).toBe('Hôm nay đến hạn thanh toán Youtube');
    expect(buildReminderEmail({ ...base, daysUntilDue: -6 }).subject).toBe('Quá hạn thanh toán Youtube 6 ngày');
    expect(buildReminderEmail({ ...base, daysUntilDue: -6 }).html).toContain('Đã quá hạn thanh toán 6 ngày.');
  });

  it('shows a 6/12-month upfront reference only when given one', () => {
    const withRef = buildReminderEmail({ ...base, daysUntilDue: 5, bulkReference: { sixPeriods: 1800, twelvePeriods: 3600 } });
    expect(withRef.html).toContain('Trả trước 6 / 12 tháng');
    expect(withRef.html).toContain('1,800');
    expect(withRef.html).toContain('3,600');

    const withoutRef = buildReminderEmail({ ...base, daysUntilDue: 5 });
    expect(withoutRef.html).not.toContain('Trả trước 6 / 12 tháng');
  });

  it('escapes user-controlled text', () => {
    const { html } = buildReminderEmail({
      ...base,
      memberName: '<script>x</script>',
      accountDetails: 'a & b <i>',
      daysUntilDue: 1,
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b &lt;i&gt;');
  });
});

describe('payment emails', () => {
  it('submitted: names the member, amount, months and links to the queue', () => {
    const { subject, html } = buildPaymentSubmittedEmail({
      memberName: 'An',
      memberEmail: 'an@x.com',
      subscriptionName: 'Youtube',
      currency: 'JPY',
      monthsCovered: 6,
      amount: 1800,
      note: 'chuyển 20/9',
      appUrl: 'https://app.example',
    });
    expect(subject).toBe('An báo đã thanh toán Youtube');
    expect(html).toContain('1,800');
    expect(html).toContain('6 tháng');
    expect(html).toContain('chuyển 20/9');
    expect(html).toContain('https://app.example/admin/payments');
  });

  it('rejected: includes the reason (escaped) and links to /me', () => {
    const { subject, html } = buildPaymentRejectedEmail({
      memberName: 'An',
      subscriptionName: 'Youtube',
      reason: '<b>chưa nhận</b>',
      appUrl: 'https://app.example',
    });
    expect(subject).toBe('Thanh toán Youtube chưa được xác nhận');
    expect(html).toContain('&lt;b&gt;chưa nhận&lt;/b&gt;');
    expect(html).toContain('https://app.example/me');
  });
});
