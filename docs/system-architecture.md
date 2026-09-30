# System Architecture

```
Browser ──> Cloudflare Worker (Next.js via OpenNext) ──> D1 (SQLite) <── Cloudflare Worker (cron 00:00 UTC = 09:00 JST)
                 │                                                            │
                 └── Resend (email, REST) <───────────────────────────────────┘        open.er-api.com (JPY→VND, from the Worker)
```

The app deploys as a Cloudflare Worker via `@opennextjs/cloudflare` (built with `pnpm cf:build`, deployed with `pnpm deploy` / `wrangler deploy`) — not Cloudflare Pages. `@cloudflare/next-on-pages` (the old Pages adapter) is deprecated/archived and has an unfixed bug where a Server Action 404s in production when called from a dynamic `[id]` route; see `docs/code-standards.md`'s note on never binding action arguments. The app Worker and the cron Worker (`worker/`) are separate deployments sharing the same D1 database. Migrations are applied from the app repo only.

## Data model (`lib/db-schema.ts`)

| Table | Purpose |
|---|---|
| `payment_accounts` | Where to send money. Currency doubles as country: JPY (Japan) allows an optional `branch_name` (banks have one; e-wallets like PayPay don't, and `account_number` is then a phone number); VND (Vietnam) allows an optional QR image path (`qr_image_path`, e.g. `/qr/vcb.png` — a static file added to `public/qr/`, not uploaded) and never has a branch. Both need `bank_name`, `account_number`, `account_holder_name`. |
| `subscriptions` | Name, currency, `billing_cycle` (monthly/yearly) + `billing_amount` for that cycle, `slot_count` (how many *other* people can share it, not counting the admin — used only to derive reference numbers), optional `remind_days_before`. Its own currency is only its own cost — an account's currency, and each member's, need not match it. |
| `subscription_payment_accounts` | Join table: which `payment_accounts` a subscription can be paid into (more than one is normal — e.g. a JPY e-wallet and a VND bank account — so sharers abroad and at home each pay in a convenient currency). |
| `members` | Name, unique lowercase email, `archived` |
| `memberships` | Member in a subscription: `monthly_share` + its own `currency`, `is_family`, **`paid_through`** (next due date), `archived`. The currency is per member and need not be the subscription's or any account's: a VND-billed Youtube can collect JPY from a sharer in Japan, who sees the amount converted to whichever of the subscription's accounts they pick. |
| `payments` | Reported or recorded payment: `months_covered`, `amount`, status `pending/approved/rejected`, note, reject reason |
| `reminder_log` | One row per sent reminder: (membership, due date, kind). Cron kinds are unique; `manual` may repeat |
| `fx_rates` | Daily JPY→VND rate |
| `user`, `session`, `account`, `verification` | better-auth |
| `login_throttle` | 60 s cooldown per allowed email for login mails |

Conventions: dates are `YYYY-MM-DD` text in JST; money is a whole integer (JPY and VND have no minor unit); timestamps are epoch ms. Enums are enforced with CHECK constraints; a partial unique index allows at most one `pending` payment per membership.

## Key invariants

- **Active rule.** A membership counts only when it and its member are both not archived. The dashboard, member view and reminders all use it.
- **Due date.** It only moves when a payment is approved or recorded, by `months_covered` *periods* of the membership's subscription's own `billing_cycle`: 1 month per period for monthly subscriptions, 12 months per period for yearly ones (`periodsToMonths()` in `lib/payments/service.ts`), then applied via `addMonths` (month-end clamped: Jan 31 + 1 = Feb 28). Approve/record is one D1 batch (a transaction) of guarded UPDATEs: the payment must still be pending and the due date must still be what was read. A double click, retry or concurrent edit cannot move it twice.
- **Billing reference numbers.** A membership's `monthly_share` is admin-entered manually (in the subscription's own cycle unit) when adding a member — never auto-filled. `computeSubscriptionReference()` (`lib/format/subscription-reference.ts`) derives display-only per-month/per-year and per-person figures from `billing_amount` ÷ (`slot_count` + 1) — the "+1" is the admin's own share — shown as a guide on the subscription page; it is never stored.
- **Access.** `getCurrentUser()` re-resolves role on every request from the session email: admin if in `ADMIN_EMAILS`, member if an active member row exists, otherwise no access (archiving a member ends their session's access at once). Every page and Server Action calls `requireAdmin()` or `requireMember()`; the admin layout is navigation only.
- **Ownership.** A member's payment request is checked against the session's member id in the service, not trusted from the form.

## Flows

**Sign-in.** `/login` -> Server Action `requestLogin`: allowlist check (same reply for unknown emails), 60 s cooldown, then one email with a magic link and a 6-digit code (OTP created first, then `signInMagicLink` sends the combined mail). The link goes through `/api/auth/*`; the code goes through `verifyCode`. Both create the session cookie. Direct calls to the public auth routes are also gated by the allowlist and rate limits.

**Payment.** Member reports (`pending`, admin emailed) -> admin approves (due date moves) or rejects with a reason (member emailed). Admin can record a payment directly (approved at once). Logic: `lib/payments/service.ts`.

**Reminders.** The Worker runs `runReminders` daily: for each active non-family membership `dueReminderKind` (`lib/reminders/compute.ts`) gives `t-minus`, `t0` or `overdue-1..5`. The milestone is claimed in `reminder_log` before sending (so reruns never double-send) and released if the send fails. No reminder while a reported payment is pending; a manual reminder the same JST day counts as done. Admin "send now" uses the same code (`sendManualReminder`).

**FX.** The Worker fetches JPY→VND, upserts today's row. The app reads the latest row and shows "≈" values plus an attribution note; nothing is shown before the first fetch.

## Modules shared by the Worker and the app

The Worker bundles `lib/reminders/*`, `lib/fx/*`, `lib/email/{resend,reminder-email,html}.ts` and `lib/format/*`. These files use relative imports only (no `@/` alias) and no Next.js or Node-only APIs.

## Security model

Stored data: names, emails, due dates, amounts, payment account text. Protected by: allowlist sign-in, HttpOnly SameSite=lax session cookie (7 days), server-side role checks, rate limits (Better Auth's store is per isolate on Workers, so best-effort) and the login cooldown. Not stored: card numbers, passwords, receipts.
