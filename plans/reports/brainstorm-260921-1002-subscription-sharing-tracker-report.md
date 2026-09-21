# Brainstorm: Subscription Sharing Tracker

Date: 2026-09-21 | Status: design agreed, pre-plan

## Problem
Admin (owner) shares Youtube + Microsoft 365 with several people. Need: track who owes/paid, history, auto email reminders before due, JPY/VND amounts, exempt family members from reminders, admin CRUD, members read-only + self-report payment.

## Requirements (confirmed)
- Roles: admin (CRUD, approve) / member (view next due, history, report "paid").
- Billing: monthly base price, member can prepay N months (1/6/12...). No fixed "period".
- Currency: each subscription has 1 currency (JPY|VND). No conversion in billing logic.
- FX: daily auto-updated JPY<->VND rate, **display only** ("≈ X VND" next to amounts, admin dashboard estimated total).
- Payment flow: member reports paid (months, amount editable, note) -> `pending` -> admin approve/reject. Admin can also record payment directly. No receipt upload.
- Payment destination: structured `payment_accounts` per currency, linked to subscription.
- Reminders: default T-7, T-0, then every 3 days overdue. Per-subscription override of "days before" via `remind_days_before` column. Family members skipped. Admin button "Gửi nhắc ngay" (logged as `manual`).
- Auth: better-auth magic link, no passwords. Admin = email allowlist in env. Members identified by email (required, unique).
- UI: Vietnamese only, no i18n.

## Out of scope (this round)
Billing in different currency than subscription, receipt upload, i18n, bank auto-detect, online payment, fully custom reminder schedules, multi-admin.

## Approaches considered
| Topic | Chosen | Rejected (why) |
|---|---|---|
| Cron host | Separate Worker + Cron Trigger, shared D1 (Pages has no cron) | GitHub Actions cron (extra secret/dependency); migrate to Workers/OpenNext (too heavy) |
| Member login | Magic link via better-auth plugin | Password (overkill); secret-URL-only (user picked magic link) |
| Due date model | `paid_through` per membership; due = paid_through | Fixed periods (breaks with 6/12-month prepay) |
| FX source | open.er-api.com (no key, daily, has VND; verified 2026-09-21 returns success) | Frankfurter/ECB (no VND -> "not found") |

## Stack (mirror `~/project/sono`)
Next.js 15 App Router + Server Actions, React 19, Tailwind 4, Radix, Drizzle + Cloudflare D1, better-auth, Resend, zod, react-hook-form, deploy `@cloudflare/next-on-pages` to Pages. Extra: `reminder-cron` Worker (same D1 binding, Resend, FX fetch). Reuse sono patterns: `lib/email/*` HTML template, `d1/migrations`, `lib/auth/get-current-user.ts`. Note sono docs mention Supabase but code uses better-auth+D1; trust `package.json`.

## Data model
| Table | Key fields |
|---|---|
| payment_accounts | currency, label, details (text) |
| subscriptions | name, currency, price_per_month, payment_account_id, remind_days_before (nullable) |
| members | name, email (unique), user_id |
| memberships | member_id, subscription_id, monthly_share, is_family, paid_through |
| payments | membership_id, months_covered, amount, status (pending/approved/rejected), note, created_at, decided_at, reject_reason |
| reminder_log | membership_id, due_date, kind (t-n/t0/overdue-n/manual), sent_at |
| fx_rates | date, base, quote, rate |

Invariant: approve payment -> `paid_through += months_covered`. Reminder uniqueness on (membership_id, due_date, kind) prevents duplicates.

## Flows
- Member: magic link -> dashboard per subscription (next due, amount + ≈ other currency, payment account, history) -> "Đã trả".
- Admin: CRUD subscriptions/members/memberships/accounts; approve/reject; record payment; "Gửi nhắc ngay"; dashboard overdue list + estimated totals.
- Cron daily ~09:00 JST: refresh fx_rates; find non-family memberships hitting reminder milestones; send via Resend; write reminder_log.

## Risks
1. Admin lockout if allowlisted email lost -> keep allowlist in env, documented.
2. Cron in UTC; compute "today" in JST or reminders skew a day.
3. Magic link depends on Resend + verified domain; free quota 100/day OK at this scale.
4. FX API free tier needs attribution; API down -> keep last stored rate, show its date.
5. Manual reconciliation only; acceptable at this scale.

## Success criteria
- Non-family member gets T-7 / T-0 / overdue-every-3-days emails exactly once each; family never.
- Prepay 12 months -> paid_through +12 months, next reminder shifts accordingly.
- Member sees only own memberships; non-admin cannot reach admin routes/actions.
- Amounts shown in native currency with ≈ converted value and rate date.
- Manual reminder logged and does not cause duplicate cron send same day.

## Next steps
`/ck:plan` from this report. Suggested phases: schema+migrations, auth (magic link + role), admin CRUD, member dashboard + payment report/approve, email + reminder Worker, FX fetch + display, deploy (Pages + Worker + Resend domain).

## Unresolved questions
- Reminder email: include direct magic-link login, or link to login page only?
- Members with same email across multiple subscriptions: one `members` row (assumed yes).
- Default T-N when `remind_days_before` null: 7 (assumed).
