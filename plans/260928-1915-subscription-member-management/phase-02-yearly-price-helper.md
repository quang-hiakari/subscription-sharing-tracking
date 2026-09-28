---
phase: 2
title: Yearly price helper
status: completed
priority: P2
effort: 1h
dependencies: []
---

# Phase 2: Yearly price helper

## Overview

Let admin type a yearly price and have it fill the existing monthly-price field, without changing storage (per user decision: UI convenience only, no `billing_cycle` column).

## Requirements

- Functional: an extra "Nhập theo năm (tuỳ chọn)" number input next to "Giá mỗi tháng". Typing a value there fills "Giá mỗi tháng" with `round(yearly / 12)`. "Giá mỗi tháng" stays a normal, directly editable required field (the submitted value) — the yearly input is never itself submitted/stored.
- Non-functional: no schema change, no new column, no server-side change; `pricePerMonth` remains the sole source of truth read everywhere else (dashboard totals, reminders, payment defaults).

## Architecture

- `app/admin/subscriptions/subscription-fields.tsx` becomes a client component (`'use client'`, same pattern as `account-fields.tsx`'s currency toggle): controlled state for the monthly-price input's value, plus an uncontrolled/local-only yearly input whose `onChange` computes `Math.round(Number(value) / 12)` and updates the monthly state (only when the yearly input is non-empty and numeric; clearing it does not clear the monthly value — it's a one-shot fill, not a lock).
- The yearly input has no `name` attribute (or `name` without being read by the schema — simplest is no `name` at all, so it's never part of the submitted FormData; `paymentAccountSchema`-style unknown-key stripping isn't even needed since it's simply absent).

## Related Code Files

- Modify: `app/admin/subscriptions/subscription-fields.tsx`

## Implementation Steps

1. Add `'use client'`, `useState` for the monthly-price field value (seed from `defaults.pricePerMonth`).
2. Add the yearly input directly below "Giá mỗi tháng" with a short hint ("Điền để tự tính giá/tháng, không lưu riêng.").
3. `onChange` on the yearly input: parse as integer, if valid and > 0 set monthly state to `Math.round(value / 12)`.
4. Make "Giá mỗi tháng" a controlled input (`value={monthly}`, `onChange` updates state so the admin can still edit it directly after auto-fill).

## Success Criteria

- [x] Typing 1,200,000 into the yearly field sets "Giá mỗi tháng" to 100,000.
- [x] A non-divisible yearly amount rounds sensibly (e.g. 1,000,000 → 83,333) and the admin can still hand-edit the monthly field afterward.
- [x] Submitting the form sends only `pricePerMonth` (no yearly field in the request); creating/editing a subscription this way behaves exactly as before.
- [x] `tsc`, `eslint`, `next build` pass.

Verified: the rounding math (`yearlyToMonthly`, moved to `lib/format/money.ts` so it's unit-testable — a plain browser onChange handler otherwise isn't reachable by this project's Node-only Vitest setup) has 4 new unit tests, including the rounding-past-.5 case. On an isolated dev server, `/admin/subscriptions/new` rendered both fields; the rendered yearly `<input>` has `name=""` (confirmed in the raw HTML — HTML spec: an empty-name field is never submitted), and creating a subscription with only `pricePerMonth` set still worked. The interactive fill-on-type behavior itself (typing in a real browser) was not driven end to end — no browser automation tool was available this session; the underlying math and the "never submitted" guarantee were verified directly instead. 121 unit tests, `tsc`, `eslint`, `next build`, `pages:build` pass.

## Implementation Notes (as built)

- Extracted `yearlyToMonthly(yearlyAmount)` into `lib/format/money.ts` (next to `formatMoney`) instead of inlining `Math.round(yearly / 12)` in the component, purely so it has a unit test — the component's `onChange` just calls it.

## Risk Assessment

- None significant — purely additive client-side UI, no data path change.
