import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, magicLink } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db-schema';
import { isLoginAllowed } from './auth/allowed-emails';
import { buildLoginEmail } from './email/login-email';
import { sendMail } from './email/send-mail';

export const LOGIN_TTL_SECONDS = 15 * 60;

/**
 * Carries the 6-digit code from the OTP plugin to the magic-link plugin so one email
 * holds both. createAuth runs per request, so this object is never shared across users.
 */
export interface PendingLogin {
  otp?: string;
}

export function createAuth(db: D1Database, pending: PendingLogin = {}) {
  const allowed = (email: string) => isLoginAllowed(db, email, process.env.ADMIN_EMAILS);

  return betterAuth({
    database: drizzleAdapter(drizzle(db, { schema }), {
      provider: 'sqlite',
      schema,
    }),
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: LOGIN_TTL_SECONDS,
        // Not sent here: the code is delivered inside the magic-link email below.
        sendVerificationOTP: async ({ otp }) => {
          pending.otp = otp;
        },
      }),
      magicLink({
        expiresIn: LOGIN_TTL_SECONDS,
        sendMagicLink: async ({ email, url }) => {
          // Better Auth's HTTP routes are public; never mail addresses outside the allowlist.
          if (!(await allowed(email))) return;
          const { subject, html } = buildLoginEmail({
            url,
            otp: pending.otp,
            expiresInMinutes: LOGIN_TTL_SECONDS / 60,
          });
          await sendMail({ to: email, subject, html });
        },
      }),
      nextCookies(), // must be last: sets the session cookie via next/headers in Server Actions
    ],
    databaseHooks: {
      user: {
        create: {
          // No open sign-up: a user row is only created for admins and active members.
          before: async (user) => ((await allowed(user.email)) ? undefined : false),
        },
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/magic-link': { window: 60, max: 3 },
        '/email-otp/send-verification-otp': { window: 60, max: 3 },
        '/sign-in/email-otp': { window: 60, max: 10 },
      },
    },
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.APP_URL!,
    trustedOrigins: [process.env.APP_URL ?? ''],
  });
}

export type Auth = ReturnType<typeof createAuth>;
