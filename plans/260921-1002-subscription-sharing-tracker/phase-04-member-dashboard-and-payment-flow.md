---
phase: 4
title: Member dashboard and payment flow
status: completed
priority: P1
effort: 5h
dependencies:
  - 3
---

# Phase 4: Member dashboard and payment flow

## Overview

Member `/me` page, "Đã trả" submission, admin approve/reject, admin direct-record payment. Core of `paid_through` logic.

## Requirements

- Functional:
  - Member sees per membership: subscription, next due (`paid_through`), amount for 1 month, payment account details, history.
  - Submit payment: `months_covered` (>=1), `amount` (default `monthly_share * months`, editable), note. Status `pending`.
  - Admin approve => `paid_through = addMonths(paid_through, months_covered)`, status `approved`, `decided_at`. Reject requires reason.
  - Admin can record a payment directly (auto-approved).
  - Family members: shown info-only, no pay button.
- Non-functional: approve must be atomic and idempotent (double click / retry cannot add months twice).

## Architecture

- `approvePayment(paymentId)`: single D1 `batch` of two compare-and-swap UPDATEs (see notes); the result's `meta.changes` tells whether it applied.
- Members can only submit for memberships whose `member_id` equals the session's active member id (checked in the service).
- Limit pending payments: one pending per membership (reject second) to avoid duplicates.
- Emails: on submit -> admin; on reject -> member (uses phase 5 helpers; stub call sites now, wire in phase 5).

## Related Code Files

- Create: `app/me/page.tsx`, `app/me/actions.ts`, `app/me/components/{membership-card,payment-form,payment-history}.tsx`, `app/admin/payments/page.tsx`, `app/admin/payments/actions.ts`, `lib/queries/payments.ts`
- Modify: `app/admin/page.tsx` (pending badge)

## Implementation Steps

1. `/me` queries scoped by session member.
2. Payment form with zod (months 1-36, amount > 0).
3. `approvePayment` / `rejectPayment` / `recordPayment` actions with atomic logic.
4. Admin payments queue page.
5. Tests: approve twice adds months once; 12-month approve shifts date; member cannot submit for another's membership; second pending rejected.

## Success Criteria

- [x] Prepay 12 months approved => `paid_through` +12 months (unit test; e2e 6 months: 2026-09-11 -> 2027-03-11)
- [x] Concurrent/double approve is a no-op the second time
- [x] Member A cannot read or submit for member B
- [x] History shows pending/approved/rejected with reason

Verified two ways. **Service on real SQLite** (`node:sqlite` with the repo's migrations, 20 tests): pending/amount default, one pending per membership, family/archived/other-member refused with an identical message, approve moves the date from the old due date (also when overdue) and clamps month ends, second and concurrent approvals move it once, compare-and-swap refuses when the date changed between read and write, reject stores the reason and never moves the date, direct record is one transaction, and a failing statement rolls the whole batch back. **UI end to end** on a throwaway D1 (dev server, real forms): member cards (overdue badge, account details, family notice), validation messages, default amount 300 x 6 = 1800, pending notice hides the form, double submit from a stale form creates one row, admin queue previews the new due date, approve/reject (reason required)/direct record, member sees the rejection and can report again, history on both sides; 9 attempts to run admin actions as member/anonymous changed nothing.

## Implementation Notes (as built)

- **Service** `lib/payments/service.ts` takes a `D1Database`; UI actions are thin wrappers. `approvePayment` = one `db.batch` of two guarded UPDATEs (payment `pending -> approved` only if the due date is unchanged; then the date moves only if that approval happened and the date is still the old one). `recordPayment` inserts an approved row and moves the date in one batch.
- **Migration** `0002_payments-one-pending.sql`: partial unique index, at most one `pending` payment per membership.
- **Amount** empty = `monthly_share x months`; explicit amount is kept. Months 1-36. Note max 200 chars.
- Member view (`getMyMemberships`) uses the same active rule as the admin side; family memberships show info only. Ownership is checked in the service against the session's member id, never trusted from the client (the bound membership id is only a hint).
- Admin: `/admin/payments` (queue with the resulting due date, approve, reject with reason, recent decisions) and, on `/admin/memberships/[id]`, "record received payment" plus history. Nav and dashboard link to the queue.
- `components/status-badge.tsx` moved out of `app/admin` (shared with `/me`).
- Email notifications (submit -> admin, reject -> member) are wired in phase 5.
- Test support `lib/payments/sqlite-d1.ts` (D1 API over `node:sqlite`, batches run atomically like D1). Dev-only knobs added: `DEV_PERSIST_DIR` (separate local D1, `next.config.mjs`) and `MAIL_TRANSPORT=console` (print mail even when a Resend key is set).
- Bug found while testing and fixed: a missing (not just blank) `amount`/`note` field was rejected; now both mean "not provided".
- Edge: when a stale form is submitted after the state changed, the error is not visible (the re-rendered page no longer has that form); the data is still protected.

## Risk Assessment

- D1 batch semantics: batches are transactions (all or nothing) and run without interleaving; tests reproduce this over SQLite and cover rollback, concurrency and compare-and-swap. Not yet exercised against a remote D1, only local (workerd) in phase 7 smoke test.
