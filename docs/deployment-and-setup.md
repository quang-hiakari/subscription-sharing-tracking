# Deployment and Setup

## Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `ADMIN_EMAILS` | app | Comma-separated, case-insensitive. Only these emails are admins. |
| `BETTER_AUTH_SECRET` | app | Random string, 32+ chars. Signs session cookies. |
| `APP_URL` | app, worker | Public base URL of the app (links in emails, auth base URL), e.g. `https://tracker.your-domain.com`. Read at request time (server-only, deliberately not `NEXT_PUBLIC_*`, which Next would freeze into the bundle at build time). |
| `RESEND_API_KEY` | app, worker | Resend API key. |
| `RESEND_FROM_EMAIL` | app, worker | e.g. `Name <noreply@your-domain>`; the domain must be verified in Resend. |
| `MAIL_TRANSPORT` | dev only | `console` prints emails instead of sending. Ignored in production. |
| `DEV_PERSIST_DIR` | dev only | Use a separate local D1 directory (e.g. for throwaway test data). Point it at the `v3` folder. |

## Local development

```bash
pnpm install
cp .env.example .env.local     # set ADMIN_EMAILS to your email
pnpm db:migrate:local
pnpm dev
```

1. Open `/login`, enter your admin email. With an empty `RESEND_API_KEY` or `MAIL_TRANSPORT=console`, the email (link + 6-digit code) is printed in the terminal running `pnpm dev`.
2. Add, in order: a payment account, a subscription, a person, then put the person in the subscription. Sign in as that person to see `/me`.
3. Restart `pnpm dev` after editing `.env.local`.

Local D1 lives in `.wrangler/state` (git-ignored). Deleting that folder resets it; run `pnpm db:migrate:local` again.

**Do not create a `.dev.vars` file in the repo root.** `next dev` loads it as bindings and it silently overrides `.env.local` (this once made every login email disappear).

Run the cron Worker locally against the same data:

```bash
pnpm exec wrangler dev -c worker/wrangler.toml --test-scheduled --persist-to .wrangler/state --var MAIL_TRANSPORT:console
curl "http://localhost:8787/__scheduled"     # runs reminders + FX refresh once
```

## Production

You need: a Cloudflare account with the domain, a Resend account with a verified sending domain, and `wrangler` logged in (`pnpm exec wrangler login`).

### 1. Database

```bash
pnpm exec wrangler d1 create subscription-tracker-db
```

Copy the printed `database_id` into **both** `wrangler.toml` and `worker/wrangler.toml`, then apply the migrations:

```bash
pnpm exec wrangler d1 migrations apply DB --remote
```

Migrations are applied from the app repo only, never from `worker/`.

### 2. Pages app

```bash
pnpm exec wrangler pages project create subscription-sharing-tracking --production-branch main
pnpm exec wrangler pages secret put BETTER_AUTH_SECRET --project-name subscription-sharing-tracking
pnpm exec wrangler pages secret put RESEND_API_KEY     --project-name subscription-sharing-tracking
pnpm exec wrangler pages secret put ADMIN_EMAILS       --project-name subscription-sharing-tracking
pnpm exec wrangler pages secret put RESEND_FROM_EMAIL  --project-name subscription-sharing-tracking

pnpm exec wrangler pages secret put APP_URL            --project-name subscription-sharing-tracking

pnpm deploy
```

Then add the custom domain in the Cloudflare dashboard (Pages project -> Custom domains).

> `APP_URL` is a runtime variable, so the deploy build does not need it, but it must be set as a secret before the first login (auth cannot build links without it). Secrets apply to deployments made after they are set: redeploy after changing one.

### 3. Cron Worker

Edit `worker/wrangler.toml`: set `APP_URL` (same public URL) and `RESEND_FROM_EMAIL` under `[vars]`, then:

```bash
pnpm exec wrangler secret put RESEND_API_KEY -c worker/wrangler.toml
pnpm exec wrangler deploy -c worker/wrangler.toml
```

It runs daily at 00:00 UTC (09:00 JST). Until its first run there is no exchange rate, so "≈" values are simply not shown.

### 4. Smoke test

1. Sign in as an admin; the email must link to your production URL (`APP_URL`), not localhost.
2. Create an account, a subscription, a test person (use an address you own) and a membership.
3. Sign in as the person; report a payment; approve it as admin; the due date moves.
4. Send a reminder now from the membership page; check the email arrives.
5. Check the Worker's next run: Cloudflare dashboard -> Worker -> Logs, or `pnpm exec wrangler tail -c worker/wrangler.toml`. Expect `[cron] reminders {...}` and `[cron] fx {...}`.

## Operations

- **Backup:** `pnpm exec wrangler d1 export subscription-tracker-db --remote --output backup.sql`.
- **Lost admin access:** change the `ADMIN_EMAILS` secret and redeploy.
- **Schema change:** edit `lib/db-schema.ts`, `pnpm db:generate --name <what>`, commit, apply with `wrangler d1 migrations apply DB --remote` **before** deploying code that needs it.
- **Cron logs:** `wrangler tail -c worker/wrangler.toml`. A failed job is logged and the run is marked failed.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| No login email in dev | Email not in `ADMIN_EMAILS` / not an active member (the reply is identical on purpose); a 60 s cooldown after a request; a stray root `.dev.vars`; `.env.local` changed without restarting. |
| Login says it could not send | Resend rejected it: check the `[requestLogin] Resend: ...` line in the server log (unverified domain, wrong key, `to` on a test domain). |
| Email link opens localhost or a wrong host | `APP_URL` is wrong or unset (app secret, or Worker `[vars]`); fix it and redeploy. |
| "Link expired" right after clicking | A mail scanner used the one-time link; use the 6-digit code from the same email. |
| No "≈" amounts | The cron has not fetched a rate yet, or the Worker is not deployed. |
| Someone is not reminded | Family member, archived, has a payment pending review, not yet within their lead time, or a reminder for that due date was already sent. |
