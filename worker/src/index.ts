import { type Mail, sendViaResend } from '../../lib/email/resend';
import { refreshFxRate } from '../../lib/fx/rates';
import { runReminders } from '../../lib/reminders/run';

// Daily cron (see wrangler.toml): emails every reminder that is due today (JST) and refreshes the
// JPY -> VND rate. Shares D1 with the Next app; all rules live in lib/ and are unit-tested there.

interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  APP_URL: string;
  /** Local testing only: "console" logs emails instead of sending them. */
  MAIL_TRANSPORT?: string;
}

async function sendReminders(env: Env, now: Date): Promise<void> {
  const send = async (mail: Mail) => {
    if (env.MAIL_TRANSPORT === 'console') {
      console.log(`[mail:console] to=${mail.to} subject=${mail.subject}`);
      return;
    }
    await sendViaResend({ apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM_EMAIL }, mail);
  };
  const summary = await runReminders({ db: env.DB, send, appUrl: env.APP_URL, now });
  console.log('[cron] reminders', JSON.stringify(summary));
}

async function refreshRate(env: Env, now: Date): Promise<void> {
  const fx = await refreshFxRate(env.DB, now);
  console.log('[cron] fx', JSON.stringify(fx));
}

async function execute(env: Env): Promise<void> {
  const now = new Date();
  // Independent jobs: one failing must not skip the other, but the run is still reported as failed.
  const results = await Promise.allSettled([sendReminders(env, now), refreshRate(env, now)]);
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  for (const f of failures) console.error('[cron] job failed:', f.reason instanceof Error ? f.reason.message : f.reason);
  if (failures.length > 0) throw new Error(`${failures.length} cron job(s) failed`);
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(execute(env));
  },
} satisfies ExportedHandler<Env>;
