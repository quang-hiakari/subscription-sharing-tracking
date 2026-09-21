---
phase: 6
title: FX rates display
status: completed
priority: P2
effort: 2h
dependencies:
  - 1
---

# Phase 6: FX rates display

## Overview

Daily fetch of JPY<->VND rate into `fx_rates`; UI shows "≈ X VND/JPY" next to amounts and estimated totals on admin dashboard. Display only; never affects billing.

## Requirements

- Functional: cron fetches `https://open.er-api.com/v6/latest/JPY` (no key, has VND; Frankfurter/ECB lacks VND) and stores JPY->VND for today; VND->JPY derived as inverse. UI shows converted value + rate date.
- Non-functional: API failure keeps last stored rate (show its date); free tier needs attribution link in footer.

## Architecture

- `lib/fx/rates.ts`: `fetchJpyToVnd` (validates `result === "success"`, `rates.VND` finite > 0), `refreshFxRate` (upsert `fx_rates(date, 'JPY', 'VND', rate)`), `latestRate`. Relative imports (Worker bundles it).
- `lib/fx/convert.ts`: `convertToOther` (rounded), `sumByCurrency`, `totalInVnd`.
- Worker `scheduled()` runs reminders and the rate refresh as independent jobs.
- App: `lib/queries/fx.ts` `getFx()`, `components/money.tsx` (`<Money>` shows the native amount plus a muted "≈" value; `<FxNote>` explains it, shows the rate date and the required attribution link).

## Related Code Files

- Created: `lib/fx/{rates,convert}.ts` (+ `fx.test.ts`), `lib/queries/fx.ts`, `components/money.tsx`
- Modified: `worker/src/index.ts`; `Money`/`FxNote` used in `app/me/page.tsx`, `app/admin/{page,payments/page,memberships/page,memberships/[id]/page,subscriptions/page}.tsx`, `components/payment-history.tsx` (attribution lives in `FxNote` on every page that shows "≈", not in the root layout, so it only appears when a rate is used)

## Implementation Steps

1. Fetch + validation with tests (mock fetch responses: success, failure, missing VND).
2. Upsert in worker; backfill today's rate on first deploy via manual invoke.
3. Convert helper + tests (rounding, inverse).
4. Show approx amounts + rate date; graceful hide when no rate exists.
5. Attribution footer.

## Success Criteria

- [x] Rate stored daily; failed fetch keeps previous rate
- [x] `/me` and admin dashboard show `≈` value with rate date
- [x] Conversion never used in payment amount calculation

Verified: 8 unit tests (fetch validation for success / non-success / missing or junk VND / HTTP error / non-JSON; rounding both ways; one row per day with same-day overwrite; failed fetch keeps the previous rate). **Real Worker run** against `open.er-api.com` stored `1 JPY = 165.195917 VND` (2026-09-21), a second same-day run left one row. **UI** on a throwaway D1: before any rate no "≈" and no attribution; after, `/me` showed ¥300 ≈ 49.559 ₫ and 40.000 ₫ ≈ ¥242, subscriptions showed both directions, the dashboard showed monthly totals (¥300 + 40.000 ₫ ≈ 89.559 ₫), matching an independent calculation. The only code that computes money for billing (`lib/payments/service.ts`) does not import `lib/fx`.

## Implementation Notes (as built)

- `Money` renders nothing extra for a zero amount or without a rate.
- Dashboard card "Tổng cần thu mỗi tháng" sums `monthly_share` of active non-family memberships per currency, with a combined VND estimate only when both currencies exist and a rate is known.
- Worker jobs use `Promise.allSettled`: each failure is logged and the run then throws so it shows as failed in Cloudflare; the other job still ran. Not exercised with a real network failure, only via unit tests of `refreshFxRate`.
- Rate date is the JST day it was fetched; a stale rate keeps showing its own date.
- First deploy: trigger the Worker once (dashboard "Trigger" or `wrangler` cron test) so a rate exists before the next 09:00 JST run.

## Risk Assessment

- Free API terms/limits change: isolated behind `fetchJpyToVnd`; failure only degrades the display (previous rate stays).
