import type { Currency } from '../db-schema';
import { formatMoney } from '../format/money';
import type { BulkPeriodsReference } from '../format/subscription-reference';
import { emailButton, emailLayout, escapeHtml } from './html';

export interface ReminderEmailInput {
  memberName: string;
  subscriptionName: string;
  currency: Currency;
  /** The member's amount per period (per month for a monthly subscription). */
  monthlyShare: number;
  dueDate: string;
  /** Negative once overdue. */
  daysUntilDue: number;
  /** Pre-formatted lines (see `formatPaymentOptions`), joined with `\n`. */
  accountDetails: string;
  appUrl: string;
  /** Only for a monthly-cycle subscription: what 6 or 12 months upfront would cost. */
  bulkReference: BulkPeriodsReference | null;
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
      ${i.bulkReference ? row('Trả trước 6 / 12 tháng', escapeHtml(`${formatMoney(i.bulkReference.sixPeriods, i.currency)} / ${formatMoney(i.bulkReference.twelvePeriods, i.currency)}`)) : ''}
      ${row('Chuyển tiền tới', escapeHtml(i.accountDetails).replace(/\n/g, '<br>'))}
    </table>
    ${i.bulkReference ? '<p style="margin:12px 0 0;font-size:13px;color:#666">Muốn trả trước nhiều tháng? Báo số tháng tương ứng khi báo đã chuyển tiền.</p>' : ''}
    <p style="margin:16px 0 0;font-size:13px;color:#666">Đã chuyển rồi? Đăng nhập, chọn "Tôi đã chuyển tiền" để báo cho chủ nhóm.</p>
    ${emailButton(`${i.appUrl}/login`, 'Mở trang thanh toán')}`);

  return { subject: subjectFor(i.subscriptionName, i.daysUntilDue), html };
}
