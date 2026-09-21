---
title: Subscription Sharing Tracker
description: >-
  Webapp tracking shared subscriptions (Youtube, M365): members, prepaid
  payments, magic-link login, auto email reminders, JPY/VND display
status: pending
priority: P2
branch: main
tags:
  - nextjs
  - cloudflare
  - d1
  - better-auth
  - resend
blockedBy: []
blocks: []
created: '2026-09-21T02:20:41.680Z'
createdBy: 'ck:plan'
source: skill
---

# Subscription Sharing Tracker

## Overview

Admin (owner) shares Youtube + M365 with others. App tracks who owes/paid, sends reminder emails before due, supports JPY/VND, exempts family. Members: magic-link login, see next due + history, self-report payment. Admin: full CRUD, approve payments, send reminder manually.

Source: [brainstorm report](../reports/brainstorm-260921-1002-subscription-sharing-tracker-report.md) (all decisions agreed there; do not reopen).

## Stack

Mirror `~/project/sono`: Next.js 15 App Router + Server Actions, React 19, Tailwind 4, Radix, Drizzle + D1, better-auth (magic link), Resend, zod, react-hook-form. Deploy Pages via `@cloudflare/next-on-pages`. Extra: `worker/` (Cron Trigger) sharing the D1. UI Vietnamese only.

## Key decisions

- Due date = `memberships.paid_through`; approve payment => `paid_through += months_covered`.
- 1 currency per subscription; FX display-only (open.er-api.com, no key).
- Admin = email allowlist env `ADMIN_EMAILS`; members matched by email.
- Reminders: T-N (`subscriptions.remind_days_before`, default 7), T-0, overdue every 3 days **max 5 times**; family and archived skipped; manual send logged as `manual`.
- Login email carries magic link **and** a 6-digit code fallback (mail scanners can consume one-time links).
- Members/memberships with payment history are archived, not deleted.
- "Today" computed in JST.
- Env names follow sono, except `APP_URL` (sono: `NEXT_PUBLIC_APP_URL`, which Next inlines at build time): `APP_URL`, `RESEND_FROM_EMAIL`, `RESEND_API_KEY`, `BETTER_AUTH_SECRET`, plus `ADMIN_EMAILS`.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Project setup and schema](./phase-01-project-setup-and-schema.md) | Completed |
| 2 | [Auth magic link and roles](./phase-02-auth-magic-link-and-roles.md) | Completed |
| 3 | [Admin CRUD](./phase-03-admin-crud.md) | Completed |
| 4 | [Member dashboard and payment flow](./phase-04-member-dashboard-and-payment-flow.md) | Completed |
| 5 | [Email and reminder worker](./phase-05-email-and-reminder-worker.md) | Completed |
| 6 | [FX rates display](./phase-06-fx-rates-display.md) | Completed |
| 7 | [Deploy and docs](./phase-07-deploy-and-docs.md) | Pending |

Order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 (linear; 6 can run any time after 1).

## Acceptance criteria

- Non-family member gets T-N / T-0 / overdue-every-3-days email exactly once each; family never.
- 12-month prepay moves `paid_through` +12 months and shifts next reminder.
- Member sees only own memberships; member cannot reach admin routes or actions.
- Amounts show native currency + `≈` converted value with rate date.
- Manual reminder logged, no duplicate cron send same day.

## Dependencies

None (no other plans). External: Resend verified domain, Cloudflare account with D1, domain.

## Open questions

- Reminder email links to the login page only (no embedded magic link; avoids scanner-consumed tokens). Not re-asked; revisit only if member friction appears.
- None. (`magicLink` plugin verified in official docs during phase 2.)

## Validation Log

### Session 1 — 2026-09-21
**Trigger:** `/ck:plan validate` before implementation.
**Questions asked:** 4

#### Verification Results
- Tier: Full (7 phases); sampled sono references
- Claims checked: 11 | Verified: 10 | Failed: 1 | Unverified: 1
- Failed: plan assumed sono had magic link; `sono/lib/auth.ts` uses `emailOTP` (6-digit code). Plan adjusted.
- Unverified: `magicLink` plugin in installed better-auth (`node_modules` read blocked by hook; not bypassed).
- Adjusted (no question needed): env names aligned to sono (`APP_URL`, `RESEND_FROM_EMAIL`); sono `middleware.ts` does not guard routes, guarding is in `getCurrentUser()` (plan already guards server-side).

#### Questions & Answers

1. **[Risks]** Magic link may be consumed by Outlook/M365 link scanners; sono uses 6-digit OTP. How to handle?
   - Options: Magic link + 6-digit fallback in same email | Magic link only | OTP only like sono
   - **Answer:** Magic link + 6-digit fallback in same email
   - **Rationale:** keeps click-to-login while surviving scanned links.
2. **[Assumptions]** Default reminder lead time when `remind_days_before` empty?
   - Options: 7 | 3 | 14
   - **Answer:** 7 days
3. **[Scope]** When do repeated overdue reminders (every 3 days) stop?
   - Options: after 5 overdue reminders | forever | only T-N and T-0
   - **Answer:** after 5 overdue reminders
   - **Rationale:** caps emails to people who left the group; admin still sees overdue on dashboard.
4. **[Architecture]** Deleting members/memberships that have payment history?
   - Options: block delete + archive | cascade delete | block entirely
   - **Answer:** block delete, use archived flag
   - **Rationale:** preserves financial history; archived rows skipped by reminders and hidden from member.

#### Confirmed Decisions
- Login: magic link + 6-digit code fallback.
- Default lead time 7 days; overdue reminders capped at 5.
- Archive instead of delete when payments exist (hard delete only with zero payments).

#### Action Items
- [x] Phase 2: confirm `magicLink` plugin in official docs, else use emailOTP only and tell user. (Confirmed; better-auth 1.7.5.)

#### Impact on Phases
- Phase 1: `archived` on members and memberships; env names.
- Phase 2: magic link + emailOTP; unverified plugin check.
- Phase 3: archive action, delete guard.
- Phase 5: overdue cap, archived skipped.
- Phase 7: env names.

### Whole-Plan Consistency Sweep
- Re-read plan.md and all 7 phases; searched `BETTER_AUTH_URL`, `overdue`, `delete`, `magic`, `default 7`. Stale `BETTER_AUTH_URL` replaced in phase 7; delete wording reconciled in phase 3; overdue cap added in phase 5. Unresolved contradictions: 0.

### Session 2 — 2026-09-21
**Trigger:** verification during phase 7 preparation.
- `NEXT_PUBLIC_APP_URL` was found inlined at build time in the server bundle (`appUrl:"http://localhost:3000"`), so a deploy built from `.env.local` would send production emails linking to localhost.
- **Decision (user):** rename to the server-only runtime variable `APP_URL`. Every earlier mention of the variable in this plan now reads `APP_URL`; the Session 1 line "env names aligned to sono" refers to `NEXT_PUBLIC_APP_URL`, the name at that time.
