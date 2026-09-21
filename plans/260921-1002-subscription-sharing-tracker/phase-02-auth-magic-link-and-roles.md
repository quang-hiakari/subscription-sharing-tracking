---
phase: 2
title: Auth magic link and roles
status: completed
priority: P1
effort: 3h
dependencies:
  - 1
---

# Phase 2: Auth magic link and roles

## Overview

better-auth with magic link plus 6-digit code fallback in the same email (no password). Role derived from `ADMIN_EMAILS`. Route guards for admin vs member.

## Requirements

- Functional: request link by email, click => session, logout. Only emails present in `members` or `ADMIN_EMAILS` may receive a link (no open signup).
- Non-functional: Vietnamese login page; link TTL 15 min; rate limit on request endpoint.

## Architecture

<!-- Updated: Validation Session 1 - magic link + 6-digit fallback; sono uses emailOTP not magic link -->
- `lib/auth.ts`: better-auth + drizzle adapter (pattern from `sono/lib/auth.ts`, which uses `emailOTP`). Add `magicLink` plugin **and** `emailOTP`; one login email contains the link and a 6-digit code (enter on login page if link gets scanned/consumed). `magicLink` plugin verified in official docs. Sends via shared `lib/email/send-mail.ts` (Resend).
- Env: `APP_URL`, `RESEND_FROM_EMAIL`, `RESEND_API_KEY`, `BETTER_AUTH_SECRET`, `ADMIN_EMAILS`.
- Guarding: sono `middleware.ts` does not guard; keep it minimal and rely on server-side `requireAdmin()/requireMember()`.
- Role: `getCurrentUser()` returns `{ user, role: 'admin'|'member', member? }`; admin if email in allowlist (case-insensitive).
- Guard with server-side `requireAdmin()` / `requireMember()` in every action/page (no middleware).
- Link member: on first login, set `members.user_id` by matching email.
- Unknown email: respond with same generic message (no enumeration).

## Related Code Files

- Created: `lib/auth.ts`, `lib/auth/{allowed-emails,get-current-user,require-role}.ts`, `lib/email/{send-mail,login-email,html}.ts`, `app/api/auth/[...all]/route.ts`, `app/login/{page.tsx,actions.ts,login-form.tsx}`, `app/logout/route.ts`, `app/{admin,me}/page.tsx` (placeholders), `.env.example`, `d1/migrations/0001_auth.sql`
- Not created: `lib/auth-client.ts`, `middleware.ts` (see notes)
- Reference: `~/project/sono/lib/auth*.ts`, `sono/middleware.ts`

## Implementation Steps

1. Add better-auth tables migration.
2. Configure magicLink + emailOTP plugins (after doc check); before sending, check email against members/admins.
3. Login page (email input, generic success message).
4. `getCurrentUser`, `requireAdmin`, `requireMember`; redirect rules: admin -> `/admin`, member -> `/me`.
5. Tests: allowlist case-insensitivity, unknown email sends nothing, member cannot pass `requireAdmin`.

## Success Criteria

- [x] Admin email logs in via link and lands on `/admin`
- [x] Member email lands on `/me`; hitting `/admin` redirects to `/me`
- [x] Unknown email: no mail sent, same response text
- [x] Expired/used link rejected; 6-digit code from the same email still logs in after the link is consumed

Verified by running the dev server and driving the real Server Actions and HTTP routes (mail printed by the dev transport): unknown and archived emails send nothing; 60s cooldown per email; scanner-consumed link then OTP login works; wrong OTP rejected; reused link redirects to `/login?error=`; archiving a member revokes an existing session; direct calls to `/api/auth/*` for non-allowlisted emails send no mail and create no user; rate limit returns 429. 23 unit tests, `tsc`, `eslint`, `next build` and `pages:build` pass.

## Implementation Notes (as built)

- **magicLink plugin verified** in official better-auth docs (`magicLink` from `better-auth/plugins`, better-auth 1.7.5). The docs do not describe a create-OTP-without-sending API, so it is not used.
- **One email with link + code:** `createAuth(db, pending)` is per request. `requestLogin` calls `sendVerificationOTP` (its callback only stores the code in `pending`), then `signInMagicLink` whose callback sends the single email containing both.
- **Allowlist enforced in three places:** `requestLogin` (generic reply, no mail), `sendMagicLink` callback (public `/api/auth/*` routes), and `databaseHooks.user.create.before` (no user rows for strangers). Sessions of removed/archived members stop working because `getCurrentUser()` re-checks admin/active-member on every call.
- **Throttle:** table `login_throttle` (60s per allowed email) guards the Server Action, since `auth.api.*` calls bypass Better Auth's HTTP rate limiter. Public routes use Better Auth `rateLimit.customRules` (3/min on send routes, default memory storage: per-isolate, so best-effort on Workers). OTP has Better Auth's default 3 attempts per code.
- **Not built (YAGNI):** `lib/auth-client.ts` (all auth goes through Server Actions) and `middleware.ts` (guards are `requireAdmin()/requireMember()` in every page/action).
- **Dev mail transport:** without `RESEND_API_KEY` and `NODE_ENV=development`, `sendMail` logs the email; production always sends via Resend and throws on error.
- `/admin` and `/me` are placeholders; phases 3 and 4 replace them. Admin who is not a member is redirected from `/me` to `/admin`.
- Migration: `d1/migrations/0001_auth.sql` (Better Auth tables + `login_throttle`).

## Risk Assessment

- Resend unverified domain blocks login: verify domain first (phase 7 prerequisite; use dev key locally).
- Admin lockout if allowlist email lost: documented recovery = edit env var.
