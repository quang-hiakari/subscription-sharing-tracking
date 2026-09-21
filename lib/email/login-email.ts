import { escapeHtml } from './html';

export interface LoginEmailInput {
  /** Magic link URL. */
  url: string;
  /** 6-digit fallback code, used when a mail scanner consumed the link. */
  otp?: string;
  /** Minutes until both expire. */
  expiresInMinutes: number;
}

export function buildLoginEmail({ url, otp, expiresInMinutes }: LoginEmailInput): { subject: string; html: string } {
  const codeBlock = otp
    ? `<p style="color:#555;font-size:14px;margin:24px 0 8px">Link không mở được? Nhập mã này trên trang đăng nhập:</p>
       <div style="font-size:32px;font-weight:700;letter-spacing:10px;color:#111;font-variant-numeric:tabular-nums">${escapeHtml(otp)}</div>`
    : '';

  const html = `
<div style="background:#f2f2f2;padding:32px 16px;font-family:sans-serif">
  <div style="background:#fff;max-width:480px;margin:0 auto;border-radius:8px;padding:32px 28px;text-align:center">
    <p style="color:#555;font-size:15px;margin:0 0 24px">Bấm nút bên dưới để đăng nhập:</p>
    <a href="${escapeHtml(url)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 40px;border-radius:6px">Đăng nhập</a>
    ${codeBlock}
    <p style="color:#999;font-size:12px;margin:28px 0 0">Hết hạn sau ${expiresInMinutes} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
  </div>
</div>`;

  return { subject: 'Đăng nhập theo dõi subscription', html };
}
