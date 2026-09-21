// Sends mail through Resend's REST API with plain fetch, so the same code runs in the Next app
// and in the cron Worker without an SDK. Relative imports only.

export interface Mail {
  to: string;
  subject: string;
  html: string;
}

export interface ResendConfig {
  apiKey: string;
  /** e.g. `Tracker <noreply@your-domain>`; the domain must be verified in Resend. */
  from: string;
}

export async function sendViaResend({ apiKey, from }: ResendConfig, mail: Mail): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: mail.to, subject: mail.subject, html: mail.html }),
  });
  if (!response.ok) {
    // Resend replies with { message } describing why (unverified domain, invalid `to`, ...).
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(`Resend: ${body.message ?? `HTTP ${response.status}`}`);
  }
}
