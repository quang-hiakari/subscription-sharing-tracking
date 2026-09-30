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
