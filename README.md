# Subscription Sharing Tracker

Web app to track people who share your subscriptions (YouTube, Microsoft 365, ...): who owes what, prepaid payments, payment history, automatic email reminders, JPY/VND amounts. UI is Vietnamese.

- **Admin** (you): manage payment accounts, subscriptions, people and who is in which subscription; approve or reject reported payments, record payments received directly, send a reminder now.
- **Member**: sign in by email (magic link or 6-digit code, no password), see the next due date, what to pay and where, payment history; report "I paid".
- **Automatic**: a daily cron emails reminders before the due date and when overdue (never to family members) and refreshes the JPY/VND rate.

## Stack

Next.js 15 (App Router, Server Actions) on Cloudflare Pages via `@cloudflare/next-on-pages`, Cloudflare D1 (SQLite) with Drizzle, better-auth (magic link + email OTP), Resend (REST), Tailwind 4, zod. A separate Cloudflare Worker runs the daily cron. Same stack as the `sono` project.

## Quick start (local)

```bash
pnpm install
cp .env.example .env.local        # set ADMIN_EMAILS to your email; see docs/deployment-and-setup.md
pnpm db:migrate:local             # create the local D1
pnpm dev                          # http://localhost:3000
```

Sign in at `/login` with an email listed in `ADMIN_EMAILS`. With `MAIL_TRANSPORT=console` (or an empty `RESEND_API_KEY`) the login email is printed in the terminal instead of sent.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Next dev server |
| `pnpm test` | Unit tests (Vitest; payment and reminder logic run on real SQLite) |
| `pnpm lint` / `pnpm exec tsc --noEmit` | Lint / typecheck |
| `pnpm db:generate` | Generate a SQL migration after editing `lib/db-schema.ts` |
| `pnpm db:migrate:local` | Apply migrations to the local D1 |
| `pnpm build` / `pnpm pages:build` | Next build / Cloudflare Pages build |
| `pnpm deploy` | Build and deploy the Pages app (see deployment doc) |

## Layout

```
app/            pages and Server Actions (/login, /me, /admin/*)
components/     shared UI (ActionForm, Money, PaymentHistory, ...)
lib/            auth, db schema, payments, reminders, fx, email, queries, validation
worker/         daily cron Worker (reminders + FX refresh)
d1/migrations/  generated SQL migrations
docs/           architecture, standards, deployment
plans/          implementation plan and reports
```

## Docs

- [Project overview and requirements](docs/project-overview-pdr.md)
- [System architecture](docs/system-architecture.md)
- [Code standards](docs/code-standards.md)
- [Deployment and setup](docs/deployment-and-setup.md)
