---
phase: 5
title: Email and reminder worker
status: completed
priority: P1
effort: 5h
dependencies:
  - 4
---

# Phase 5: Email and reminder worker

## Overview

Resend email helpers + shared reminder logic + Cron Trigger Worker + admin "Gửi nhắc ngay" button.

## Requirements

- Functional:
  - Milestones for non-family, non-archived memberships: T-N (N = `remind_days_before` ?? 7), T-0, then overdue every 3 days, **stop after 5 overdue reminders** (days 3,6,9,12,15).
  <!-- Updated: Validation Session 1 - overdue cap 5, archived skipped, default 7 confirmed -->
  - `reminder_log` partial UNIQUE(membership_id, due_date, kind) WHERE kind != 'manual' (already in phase 1 schema) guarantees once-only for cron kinds; manual rows are not unique. Kinds: `t-minus`, `t0`, `overdue-1`..`overdue-5`, `manual`.
  - Reminder email links to the login page (no embedded token).
  - Admin button sends now, logs `manual`; cron must not send same-day duplicate of a milestone already covered.
  - Payment notification emails (submit -> admin, reject -> member) wired here.
- Non-functional: dates in JST; worker idempotent (rerun same day sends nothing new); failures logged, one failed send doesn't stop others.

## Architecture

- `lib/reminders/compute.ts` (pure): `dueReminderKind(target, today) => kind | null`. Shared with the Worker by **relative imports** from `lib/` (no separate `shared/` dir); every module the Worker bundles avoids the `@/` alias and Next imports.
- `lib/email/*`: `resend.ts` (REST `fetch`, no SDK, runs in Next and Workers), `send-mail.ts` (app wrapper reading env), templates `reminder-email`, `payment-emails`, shared `html` layout.
- `worker/`: own `wrangler.toml` (`[triggers] crons = ["0 0 * * *"]` = 09:00 JST), same D1 binding, secrets `RESEND_API_KEY`. `scheduled()` runs reminders then FX refresh (phase 6).
- Insert into `reminder_log` first (INSERT OR IGNORE), send only if a row was inserted; on send failure delete the row so next run retries.

## Related Code Files

- Created: `lib/reminders/{constants,compute,run}.ts` (+ tests), `lib/email/{resend,reminder-email,payment-emails}.ts` (+ tests), `lib/payments/notify.ts`, `worker/{wrangler.toml,src/index.ts}`, `sendReminderNow` in `app/admin/memberships/actions.ts`, reminder section on `app/admin/memberships/[id]/page.tsx`, `listRemindersForMembership` / `memberEmail` in `lib/queries/admin.ts`
- Modified: `app/me/actions.ts`, `app/admin/payments/actions.ts` (notifications), `lib/email/{send-mail,html}.ts`, `lib/format/money.ts` (relative import), `.gitignore`/`eslint.config.mjs` (nested `.wrangler`)
- Removed dependency: `resend` SDK (also removes the `@react-email/render` build warning)

## Implementation Steps

1. Mail helper + HTML templates (Vietnamese, minimal, copy sono `email-html-template.ts` style).
2. Pure `compute` with table-driven tests: T-7, T-0, overdue day 3/6/15, day 18 => null (cap), family => null, archived => null, custom N, already-paid => null, prepaid far future => null.
3. Worker scheduled handler with insert-first idempotency.
4. Manual send action + button on admin membership list.
5. Wire payment emails.
6. Test locally: `wrangler dev --test-scheduled`.

## Success Criteria

- [x] Compute tests cover all milestones and pass
- [x] Running worker twice same day sends once
- [x] Family member never emailed
- [x] Manual send appears in log; cron same day doesn't duplicate
- [x] Send failure retried next run

Verified three ways. **Unit tests on real SQLite** (`lib/reminders/run.test.ts`, 13 tests): once per due date, silent for family/archived/not-due, custom lead time, full timeline t-minus -> t0 -> overdue 3/6/9/12/15 -> stop, fresh cycle after a payment moves the due date, no nagging while a payment is pending (resumes after rejection), failed send releases its claim and does not block others, manual send suppresses the same-JST-day cron send but not the next day, JST vs UTC "today". **Real Worker** (`wrangler dev --test-scheduled`, seeded local D1): reminded only the due-soon and the 3-days-overdue members (skipped family and far-future), second run sent 0; with an invalid Resend key it reported `failed: 2` with Resend's own message and left no claims behind. **App** (dev server): member reports payment -> admin email, admin rejects -> member email with the reason, "Gửi nhắc ngay" emails the member and shows a "Gửi tay" row, no reminder form for family. 100 unit tests, `tsc`, `eslint`, `next build`, `pages:build` and `wrangler deploy --dry-run` for the Worker pass.

## Implementation Notes (as built)

- **Rules** (`dueReminderKind`): `t-minus` while `0 < days <= lead` (catch-up: still sent once if a cron run was missed), `t0` on the due date, then `overdue-k` = `min(5, floor(overdueDays / 3))`; the capped kind stays `overdue-5` so it is never repeated. A missed due-date run is not back-filled as `t0`.
- **`runReminders`** claims `(membership, due date, kind)` with `INSERT OR IGNORE` **before** sending; `changes = 0` means already sent. Send failure deletes the claim. Skips (no claim): payment pending. Claims without sending: admin already sent a manual reminder today (JST).
- **Manual** (`sendManualReminder`): send, then log `manual` (not unique, may repeat); refused for family/archived.
- **Emails**: reminder links to `/login` (no token in mail). Payment notices are best-effort (`lib/payments/notify.ts`): a mail error is logged and never fails the action. Admin recipients = `ADMIN_EMAILS`.
- **Resend via REST `fetch`** (`lib/email/resend.ts`) instead of the SDK, so the Worker stays small (30 KiB) and the build warning is gone.
- **Worker** (`worker/`): cron `0 0 * * *` (09:00 JST), same D1, vars `APP_URL` / `RESEND_FROM_EMAIL` in `wrangler.toml`, secret `RESEND_API_KEY`; `MAIL_TRANSPORT=console` (var) logs instead of sending, for local runs only. Local run: `wrangler dev -c worker/wrangler.toml --test-scheduled --persist-to <dir>` then `curl localhost:8787/__scheduled`. FX refresh is added to `scheduled()` in phase 6.
- Worker `.dev.vars` (if needed) must live in `worker/`, not the repo root: a root `.dev.vars` is loaded by `next dev` and overrides `.env.local`.

## Risk Assessment

- Cron UTC vs JST: cron at 00:00 UTC, compute today via JST helper.
- Resend quota/outage: log errors; admin can see last reminder per membership.
- Code sharing between Pages app and Worker: modules the Worker imports (`lib/reminders/*`, `lib/email/{resend,reminder-email,html}`, `lib/format/*`) must keep relative imports and no Next/Node-only APIs.
