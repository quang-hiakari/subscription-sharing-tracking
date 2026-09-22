---
phase: 3
title: Admin CRUD
status: completed
priority: P1
effort: 5h
dependencies:
  - 2
---

# Phase 3: Admin CRUD

## Overview

Admin screens + Server Actions for payment accounts, subscriptions, members, memberships, and admin dashboard (overdue list, estimated totals placeholder for FX).

## Requirements

- Functional: create/edit/delete each entity; membership form sets `monthly_share`, `is_family`, initial `paid_through`.
- Non-functional: every action calls `requireAdmin()`; zod validation server-side; Vietnamese UI; delete allowed only when no payments exist; otherwise action offers "Ẩn" (set `archived = 1`). Archived members/memberships are hidden from member view, skipped by reminders, kept in history, and can be restored.
<!-- Updated: Validation Session 1 - archive instead of delete -->
- Non-negotiable: dashboards/lists exclude archived by default with a toggle to show them.

## Architecture

Routes under `app/admin/`:
- `/admin` dashboard: overdue and due-soon memberships (non-family), pending payments count
- `/admin/subscriptions`, `/admin/members`, `/admin/accounts`
- `/admin/memberships` (or nested under a subscription): list per subscription with paid_through and status
Rules: subscription currency must equal its payment account currency; membership `monthly_share` currency = subscription currency.
Status derivation (`lib/queries/membership-status.ts`): `family | ok | due_soon | overdue` from `paid_through` vs `todayJst()` and `remind_days_before`.

## Related Code Files

- Created: `app/admin/{layout,page,status-badge}.tsx`; per area (`accounts`, `subscriptions`, `members`, `memberships`): `page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `actions.ts`, `*-fields.tsx`; `components/action-form.tsx`, `components/ui/{fields,page-parts}.tsx`; `lib/queries/{admin,membership-status}.ts`, `lib/validation/schemas.ts`, `lib/reminders/constants.ts`, `lib/form-state.ts`, `lib/currency-options.ts`; `getDrizzle()` in `lib/db.ts`; `isValidDate` in `lib/format/date.ts`
- Modified: `eslint.config.mjs` (ignore build dirs, allow `_`-prefixed unused args)
- Not created: Radix/sono UI wrappers (see notes)

## Implementation Steps

1. ~~Port UI primitives from sono~~ Native inputs + one shared `ActionForm` (see notes).
2. Accounts + subscriptions CRUD (currency match validation).
3. Members CRUD (email unique, normalized lowercase).
4. Memberships CRUD incl. family toggle.
5. Dashboard queries + status derivation with unit tests.
6. Delete guard: hard delete only if zero payments, else archive/restore actions (+ tests).

## Success Criteria

- [x] Admin can add Youtube (JPY) and M365 (VND) with different accounts, add members, assign shares
- [x] Currency mismatch between subscription and account rejected
- [x] Status derivation tests pass (family never overdue)
- [x] Non-admin server action calls fail

Verified by driving the real pages/forms against the dev server with an admin session (dashboard showed overdue and due-soon rows, family excluded), including: validation errors, duplicate email/membership, currency guards both directions, delete-vs-archive guards, archive hides a member from dashboard/list/new-membership and blocks re-adding, restore, hard delete removes `reminder_log` rows, delete guard holds when a payment appears after the form rendered, edits, unknown ids return 404. **Access control:** 10 direct calls of admin Server Actions (create/update/archive) with a member cookie and with no cookie all failed, DB counts unchanged; member/anonymous page requests redirect to `/me` / `/login`. 45 unit tests, `tsc`, `eslint`, `next build`, `pages:build` pass.

## Implementation Notes (as built)

- **UI:** native `<input>/<select>/<textarea>` + Tailwind, one client `ActionForm` (`useActionState`, error banner, pending state, optional `confirm()`), no Radix/dialog/toast (KISS; no extra dependencies). Forms are separate pages (`new`, `[id]`), not modals.
- **Every page and action calls `requireAdmin()`**; `app/admin/layout.tsx` is navigation only.
- **Actions signature** `(…boundArgs, prev, formData) => FormState`, bound with `.bind(null, id)`; success `redirect()`s to the list, failures return `{ error }`.
- **Active rule** (`listMemberships`): membership not archived AND member not archived. Dashboard, reminders (phase 5) and the member view (phase 4) must use the same rule. Archiving a member does not touch their memberships; restoring the member restores access to them.
- **Guards:** account delete blocked by subscriptions; subscription delete blocked by any membership (even archived); member delete blocked by any membership (else archive); membership delete blocked by payments (else archive), and deletes its `reminder_log` rows in one batch. Currency cannot change on an account with subscriptions or a subscription with memberships.
- **Editing a member's email** changes the login identity: an existing session for the old email stops working (access is re-resolved by session email on each request).
- **`paid_through` is editable by admin** as a correction tool; payments (phase 4) move it automatically.
- **Known quirk:** a no-JS form POST (multipart, `$ACTION_*` fields) that ends in `redirect()` answers 500 with an empty body on both `next dev` and `wrangler pages dev`, even for a minimal `redirect()`-only action; the data is written correctly. Real users submit through the JS `fetch` path (redirect works, verified for login in phase 2). Not fixed: the app requires JS anyway.
- Edge case: if a payment appears between rendering the page and pressing "Xoá", the action refuses to delete but its message is not visible because the re-rendered page no longer has the delete form.
- Dashboard estimated totals wait for phase 6 (FX).

## Risk Assessment

- Scope creep in UI: keep tables + simple forms, no pagination (few rows).

## Follow-up — 2026-09-22: structured, per-country bank fields

`payment_accounts.details` (one free-text blob) replaced with structured fields, country-specific by
currency (currency already forced a 1:1 mapping to country in this app: JPY = Japan, VND = Vietnam):
`bank_name`, `branch_name` (Japan only, required there), `account_number`, `account_holder_name`, and
`qr_image_path` (Vietnam only, optional). `label` stays as an admin-only nickname (not shown to members).

QR image storage went through three designs before landing, each on direct user instruction:
R2 bucket + session-gated serving route → inline base64 data URL in the D1 row → **static file under
`public/qr/`, referenced by path** (final). The static-asset approach means adding or changing a QR
is a code change (add the file, commit, deploy), not an in-app upload — the trade-off the user asked
for over any storage/upload machinery. `public/qr/README.md` documents the step for future edits.

- Migration `0003_payment-account-country-fields.sql`: SQLite table-recreate (drizzle-kit generated
  the shell; the generated `INSERT ... SELECT` referenced the new columns on the *old* table, which
  doesn't have them — hand-fixed to backfill existing rows with a `(cần cập nhật)` placeholder for the
  three required text fields instead). Verified on a standalone `node:sqlite` run (re-run after each
  redesign): old-shape rows migrate to the placeholder, the CHECK rejects JPY+QR and VND+branch in
  both directions, valid JP/VN inserts still work.
- `qrImagePath` is plain text validated against `^/qr/[\w.-]+\.(png|jpe?g|webp)$` in
  `lib/validation/schemas.ts`; forced to `null` server-side when currency is JPY (symmetric with
  `branchName` forced to `null` for VND). No upload endpoint, no file validation code, no Cloudflare
  binding.
- `components/payment-account-details.tsx` (structured display + `<img src={qrImagePath}>`) used by
  the accounts list/edit pages and `/me`; `lib/format/payment-account.ts` `formatAccountLines()`
  reused by the reminder email (`lib/reminders/run.ts`) — email lists bank/account/holder text and,
  if a QR path exists, "(Có mã QR trong app, đăng nhập để xem)" rather than embedding the image.
- Verified end to end on a throwaway dev server with a real PNG committed to `public/qr/`: JPY create
  without a branch rejected, an invalid QR path rejected, JPY with a branch and VND with a valid QR
  path both created and displayed correctly (list, edit-page live preview, `/me`, and a triggered
  reminder email all showed the right fields/image). 115 unit tests (up from 45; new: `payment-account`
  formatting, `paymentAccountSchema` branch/country/QR-path rules), `tsc`, `eslint`, `next build`,
  `pages:build`, worker `deploy --dry-run` pass.
- Not yet applied to any deployed/remote D1 (still pre-deploy); local dev DB re-migrated cleanly each
  time. Migration 0003 was rewritten in place (not layered as 0004/0005) since it was never pushed.
