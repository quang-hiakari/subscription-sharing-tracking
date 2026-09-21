import type { Currency } from '../db-schema';
import { formatMoney } from '../format/money';
import { emailButton, emailLayout, escapeHtml } from './html';

/** To the admin: a member reported a payment and it awaits review. */
export function buildPaymentSubmittedEmail(i: {
  memberName: string;
  memberEmail: string;
  subscriptionName: string;
  currency: Currency;
  monthsCovered: number;
  amount: number;
  note: string | null;
  appUrl: string;
}): { subject: string; html: string } {
  const html = emailLayout(`
    <p style="margin:0 0 12px;font-weight:600">${escapeHtml(i.memberName)} báo đã thanh toán.</p>
    <p style="margin:0;font-size:14px">
      ${escapeHtml(i.subscriptionName)}: <strong>${escapeHtml(formatMoney(i.amount, i.currency))}</strong> cho ${i.monthsCovered} tháng<br>
      <span style="color:#666">${escapeHtml(i.memberEmail)}</span>
      ${i.note ? `<br>Ghi chú: ${escapeHtml(i.note)}` : ''}
    </p>
    ${emailButton(`${i.appUrl}/admin/payments`, 'Xem và xác nhận')}`);
  return { subject: `${i.memberName} báo đã thanh toán ${i.subscriptionName}`, html };
}

/** To the member: the admin did not accept the reported payment. */
export function buildPaymentRejectedEmail(i: {
  memberName: string;
  subscriptionName: string;
  reason: string;
  appUrl: string;
}): { subject: string; html: string } {
  const html = emailLayout(`
    <p style="margin:0 0 12px">Chào ${escapeHtml(i.memberName)},</p>
    <p style="margin:0 0 8px">Thanh toán bạn báo cho <strong>${escapeHtml(i.subscriptionName)}</strong> chưa được xác nhận.</p>
    <p style="margin:0;font-size:14px">Lý do: ${escapeHtml(i.reason)}</p>
    ${emailButton(`${i.appUrl}/me`, 'Mở trang thanh toán')}`);
  return { subject: `Thanh toán ${i.subscriptionName} chưa được xác nhận`, html };
}
