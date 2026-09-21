import { type Mail, sendViaResend } from './resend';

export type { Mail };

/** Sends from the Next app using its environment (RESEND_API_KEY, RESEND_FROM_EMAIL). */
export async function sendMail(mail: Mail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  // Local development: print instead of sending when there is no Resend key or MAIL_TRANSPORT=console.
  // Never applies in production.
  if (process.env.NODE_ENV === 'development' && (!apiKey || process.env.MAIL_TRANSPORT === 'console')) {
    console.log(`[mail:dev] to=${mail.to} subject=${mail.subject}\n${mail.html}`);
    return;
  }

  await sendViaResend({ apiKey: apiKey!, from: process.env.RESEND_FROM_EMAIL! }, mail);
}
