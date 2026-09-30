import type { Currency } from '../db-schema';
import { formatMoney } from './money';

export interface PaymentAccountInfo {
  bankName: string;
  branchName: string | null;
  accountNumber: string;
  accountHolderName: string;
  /** Path to a static QR image under public/ (e.g. "/qr/vcb.png"), or null. */
  qrImagePath: string | null;
}

/** Labeled lines describing an account, for plain-text contexts (emails). */
export function formatAccountLines(a: PaymentAccountInfo): string[] {
  const lines = [`Ngân hàng: ${a.bankName}`];
  if (a.branchName) lines.push(`Chi nhánh: ${a.branchName}`);
  lines.push(`Số tài khoản: ${a.accountNumber}`, `Chủ tài khoản: ${a.accountHolderName}`);
  if (a.qrImagePath) lines.push('(Có mã QR trong app, đăng nhập để xem)');
  return lines;
}

export interface PaymentOption {
  currency: Currency;
  /** Null when this account's currency differs from the amount owed and no FX rate is known yet. */
  amount: number | null;
  account: PaymentAccountInfo;
}

/**
 * One block per payment option (an account plus how much to send into it, in that account's own
 * currency) — a subscription can have accounts in more than one currency, so a member picks
 * whichever is convenient. Blocks are separated by a blank line.
 */
export function formatPaymentOptions(options: PaymentOption[]): string[] {
  return options.flatMap((o, i) => {
    const amountLine = `Số tiền: ${o.amount == null ? 'chưa có tỷ giá quy đổi' : formatMoney(o.amount, o.currency)}`;
    const lines = [amountLine, ...formatAccountLines(o.account)];
    return i === 0 ? lines : ['', ...lines];
  });
}
