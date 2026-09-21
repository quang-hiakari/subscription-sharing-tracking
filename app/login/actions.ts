'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAuth, type PendingLogin } from '@/lib/auth';
import { isLoginAllowed, normalizeEmail } from '@/lib/auth/allowed-emails';
import { getDB } from '@/lib/db';

const COOLDOWN_MS = 60_000;
const emailSchema = z.string().email();

/**
 * Sends one email with a magic link and a 6-digit fallback code.
 * The reply is identical for unknown and known addresses (no account enumeration);
 * only allowlisted addresses are mailed, and each at most once per cooldown.
 */
export async function requestLogin(rawEmail: string): Promise<{ error?: string }> {
  const parsed = emailSchema.safeParse(normalizeEmail(rawEmail));
  if (!parsed.success) return { error: 'Email không hợp lệ.' };
  const email = parsed.data;

  const db = getDB();
  if (!(await isLoginAllowed(db, email, process.env.ADMIN_EMAILS))) return {};

  const now = Date.now();
  const claim = await db
    .prepare(
      `INSERT INTO login_throttle (email, last_sent_at) VALUES (?, ?)
       ON CONFLICT(email) DO UPDATE SET last_sent_at = excluded.last_sent_at
       WHERE login_throttle.last_sent_at <= ?`,
    )
    .bind(email, now, now - COOLDOWN_MS)
    .run();
  if (claim.meta.changes === 0) return {};

  const pending: PendingLogin = {};
  const auth = createAuth(db, pending);
  const requestHeaders = await headers();
  try {
    // Order matters: the OTP is stashed in `pending`, then the magic-link mail carries it.
    await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' }, headers: requestHeaders });
    await auth.api.signInMagicLink({
      body: { email, callbackURL: '/', errorCallbackURL: '/login?error=link' },
      headers: requestHeaders,
    });
  } catch (err) {
    console.error('[requestLogin]', err instanceof Error ? err.message : String(err));
    // Release the cooldown so the user can retry right away.
    await db.prepare('DELETE FROM login_throttle WHERE email = ?').bind(email).run();
    return { error: 'Không thể gửi email. Vui lòng thử lại.' };
  }
  return {};
}

export async function verifyCode(rawEmail: string, otp: string): Promise<{ error?: string }> {
  const email = normalizeEmail(rawEmail);
  try {
    await createAuth(getDB()).api.signInEmailOTP({
      body: { email, otp: otp.trim() },
      headers: await headers(),
    });
  } catch (err) {
    console.error('[verifyCode]', err instanceof Error ? err.message : String(err));
    return { error: 'Mã không đúng hoặc đã hết hạn.' };
  }
  redirect('/');
}
