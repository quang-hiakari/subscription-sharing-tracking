import type { Currency } from '../db-schema';
import { formatMoney } from '../format/money';
import { emailButton, emailLayout, escapeHtml } from './html';

export interface ReminderEmailInput {
  memberName: string;
  subscriptionName: string;
  currency: Currency;
  /** The member's amount per month. */
  monthlyShare: number;
  dueDate: string;
  /** Negative once overdue. */
  daysUntilDue: number;
  accountLabel: string;
  accountDetails: string;
  appUrl: string;
}

function subjectFor(subscription: string, daysUntilDue: number): string {
  if (daysUntilDue > 0) return `Sắp đến hạn thanh toán ${subscription}: còn ${daysUntilDue} ngày`;
  if (daysUntilDue === 0) return `Hôm nay đến hạn thanh toán ${subscription}`;
  return `Quá hạn thanh toán ${subscription} ${-daysUntilDue} ngày`;
}

function headlineFor(daysUntilDue: number): string {
  if (daysUntilDue > 0) return `Còn ${daysUntilDue} ngày đến hạn thanh toán.`;
  if (daysUntilDue === 0) return 'Hôm nay là hạn thanh toán.';
  return `Đã quá hạn thanh toán ${-daysUntilDue} ngày.`;
}

export function buildReminderEmail(i: ReminderEmailInput): { subject: string; html: string } {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${label}</td><td style="padding:4px 0">${value}</td></tr>`;

  const html = emailLayout(`
    <p style="margin:0 0 4px">Chào ${escapeHtml(i.memberName)},</p>
    <p style="margin:0 0 16px;font-weight:600">${escapeHtml(headlineFor(i.daysUntilDue))}</p>
    <table style="font-size:14px;border-collapse:collapse">
      ${row('Subscription', escapeHtml(i.subscriptionName))}
      ${row('Hạn thanh toán', escapeHtml(i.dueDate))}
      ${row('Mỗi tháng', escapeHtml(formatMoney(i.monthlyShare, i.currency)))}
      ${row('Chuyển tiền tới', `<strong>${escapeHtml(i.accountLabel)}</strong><br>${escapeHtml(i.accountDetails).replace(/\n/g, '<br>')}`)}
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:#666">Đã chuyển rồi? Đăng nhập, chọn "Tôi đã chuyển tiền" để báo cho chủ nhóm.</p>
    ${emailButton(`${i.appUrl}/login`, 'Mở trang thanh toán')}`);

  return { subject: subjectFor(i.subscriptionName, i.daysUntilDue), html };
}
