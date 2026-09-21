const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape text for HTML body and attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Wraps email content in the shared card layout. `inner` must already be escaped HTML. */
export function emailLayout(inner: string): string {
  return `
<div style="background:#f2f2f2;padding:32px 16px;font-family:sans-serif;color:#111">
  <div style="background:#fff;max-width:480px;margin:0 auto;border-radius:8px;padding:28px">
${inner}
  </div>
</div>`;
}

/** A primary call-to-action button. */
export function emailButton(href: string, label: string): string {
  return `<p style="margin:24px 0 0;text-align:center"><a href="${escapeHtml(href)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 32px;border-radius:6px">${escapeHtml(label)}</a></p>`;
}
