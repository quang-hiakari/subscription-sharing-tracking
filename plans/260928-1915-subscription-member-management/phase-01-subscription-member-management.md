---
phase: 1
title: Subscription member management
status: completed
priority: P1
effort: 4h
dependencies: []
---

# Phase 1: Subscription member management

## Overview

Move "who is in this subscription" and "add a member" onto `/admin/subscriptions/[id]`, in one action that handles both an existing member and a brand-new one. Retire the standalone membership list and new-membership screens.

## Requirements

- Functional:
  - `/admin/subscriptions/[id]` shows the subscription's current members (name, monthly share, family/status badge, link to their detail page) and an add-member panel.
  - Add-member panel: toggle "Người có sẵn" (select, only members not already in this subscription) / "Người mới" (name + email). Both share monthly share, family checkbox, paid-through date (reuses `MembershipTermsFields`).
  - One Server Action creates the member (if new) and the membership together.
  - Nav no longer has "Thành viên trong sub"; `/admin/memberships` (list) and `/admin/memberships/new` are removed.
- Non-functional: `requireAdmin()` on the action and every page; same guards as today (no duplicate membership, no archived member, email uniqueness for a new member).

## Architecture

- **Query changes** (`lib/queries/admin.ts`):
  - `listMemberships(includeArchived = false, subscriptionId?: number)` — add the optional filter (`and(..., subscriptionId ? eq(memberships.subscriptionId, subscriptionId) : undefined)`); existing callers (`listAttention`) pass no second arg, unaffected.
  - `listAvailableMembersForSubscription(subscriptionId)` — two plain queries (no subquery, matches existing `inArray` usage style): select `memberId` from `memberships` where `subscriptionId = ?` (any status, since the unique index blocks re-adding even an archived row) into a JS array, then `listMembers()` filtered to `!archived && !takenIds.includes(m.id)`.
- **Validation** (`lib/validation/schemas.ts`): add
  ```ts
  export const addMemberToSubscriptionSchema = z.discriminatedUnion('mode', [
    membershipUpdateSchema.extend({ mode: z.literal('existing'), memberId: id('Chọn thành viên') }),
    membershipUpdateSchema.extend({ mode: z.literal('new'), name: z.string().trim().min(1, 'Nhập tên thành viên').max(100), email: z.string().trim().toLowerCase().email('Email không hợp lệ') }),
  ]);
  ```
  (`membershipUpdateSchema` already = `{ monthlyShare, isFamily, paidThrough }`; reused as-is for the shared terms.)
- **Action** (`app/admin/memberships/actions.ts`): replace `createMembership` with
  `addMemberToSubscription(subscriptionId, prev, formData)`:
  1. `requireAdmin()`, parse `addMemberToSubscriptionSchema`.
  2. Confirm the subscription exists.
  3. `mode: 'existing'` → load the member, reject if missing/archived. `mode: 'new'` → `emailTaken()` check, then `insert(members)...returning({ id })` (new to this codebase — D1/SQLite supports `RETURNING`; verify with a manual insert during implementation).
  4. `membershipExists(memberId, subscriptionId)` guard (unchanged behavior).
  5. Insert the membership; `redirect('/admin/subscriptions/' + subscriptionId)`.
  - Other actions in this file keep their behavior; only redirect targets change where the list they pointed at is gone:
    - `updateMembership`, `setMembershipArchived` → redirect to `/admin/memberships/${id}` (detail page; still exists) instead of the old list.
    - `deleteMembership` → look up `getMembership(id)` first for its `subscriptionId`-equivalent (fetch the row before deleting, since after delete the detail page 404s), redirect to `/admin/subscriptions/${subscriptionId}`. **Note:** `getMembership()` currently returns `subscriptionName`, not `subscriptionId` — add `subscriptionId` to its selected columns (small, backward-compatible addition).
    - `sendReminderNow`, `recordMembershipPayment` already redirect to the detail page; unchanged.
- **New component** `app/admin/subscriptions/[id]/add-member-form.tsx` (`'use client'`, pattern matches `app/admin/accounts/account-fields.tsx`'s currency toggle): local state for `mode`, renders the existing-member `SelectField` or the new-member `Field`s accordingly, plus `MembershipTermsFields`. Wrapped by the page in `<ActionForm action={addMemberToSubscription.bind(null, subscriptionId)} submitLabel="Thêm thành viên">`.
- **Page** `app/admin/subscriptions/[id]/page.tsx`: add, above the existing edit form, a members table for this subscription (`listMemberships(false, id)`, `membershipStatus()` + `<StatusBadge>` per row as `app/admin/memberships/page.tsx` did) and the add-member panel (skip entirely, with a one-line note, if `listAvailableMembersForSubscription` is empty AND creating-new is always available regardless — "no existing members left" only hides the "existing" toggle option, never blocks the page).
- **Deletes:** `app/admin/memberships/page.tsx`, `app/admin/memberships/new/page.tsx`.
- **Nav** (`app/admin/layout.tsx`): remove the "Thành viên trong sub" entry; reorder `NAV` to `Tổng quan, Subscription, Thanh toán, Người dùng, Tài khoản nhận tiền` (Tổng quan stays the post-login landing page — it's the useful overview dashboard, not being replaced).

## Related Code Files

- Modify: `lib/queries/admin.ts` (`listMemberships` filter param, `getMembership` add `subscriptionId`, new `listAvailableMembersForSubscription`), `lib/validation/schemas.ts` (`addMemberToSubscriptionSchema`), `app/admin/memberships/actions.ts` (replace `createMembership`, fix redirects), `app/admin/subscriptions/[id]/page.tsx`, `app/admin/layout.tsx`
- Create: `app/admin/subscriptions/[id]/add-member-form.tsx`
- Delete: `app/admin/memberships/page.tsx`, `app/admin/memberships/new/page.tsx`

## Implementation Steps

1. Query changes in `lib/queries/admin.ts`.
2. `addMemberToSubscriptionSchema` in `lib/validation/schemas.ts`.
3. `addMemberToSubscription` action + redirect fixes in `app/admin/memberships/actions.ts`.
4. `add-member-form.tsx` client component.
5. Wire into `app/admin/subscriptions/[id]/page.tsx` (members table + add panel).
6. Delete the two retired pages; update nav.
7. Manual verification on the dev server (see Success Criteria) — this app has no route/page tests, so drive it for real like every other phase in the main tracker plan.

## Success Criteria

- [x] From a subscription's detail page: add an existing member (share + family), add a brand-new member (name+email+share+family), both appear in the members table immediately.
- [x] Re-adding a member already in that subscription is rejected with a clear message; a new-member email already used elsewhere is rejected.
- [x] `/admin/memberships` and `/admin/memberships/new` are gone (404); no link in the app points at them; `/admin/memberships/[id]` still works (edit terms, archive, delete, reminder, record payment) and is reachable from the subscription page.
- [x] Deleting a membership (no payment history) redirects to the subscription page, not a 404.
- [x] `tsc`, `eslint`, `next build`, `pages:build` pass; no regression to dashboard/payments/reminders (they read the same columns, unchanged).

Verified on an isolated dev server + throwaway local D1 (never touched the user's own `pnpm dev` on port 3000 or its data): added existing member An (¥300) and new member Chi (¥400, family) to a subscription in one action each; re-adding An rejected ("đã có trong subscription này"); new member with Binh's email rejected ("đã được dùng cho người khác"); members table showed both with correct status/family badge, and the "existing" dropdown correctly dropped them once added. `/admin/memberships` and `/admin/memberships/new` both 404. On `/admin/memberships/[id]`: update, archive (row disappears from the subscription's default view, shows under `?archived=1` as "Đã ẩn"), unarchive (reappears) all worked; delete (Chi's membership, no payment history) removed the row (`/admin/memberships/2` then 404) and Chi reappeared in the "existing member" list (proves the action ran to completion, i.e. `getMembership` returned a row and the redirect target had a real `subscriptionId`). Dashboard and its link to the membership detail page unaffected. Unauthenticated request to `/admin/subscriptions/1` still redirects to `/login`. 119 unit tests (4 new, for `addMemberToSubscriptionSchema`), `tsc`, `eslint`, `next build`, `pages:build` pass.

## Implementation Notes (as built)

- `.returning({ id: members.id })` works on local D1 as expected (confirmed by the new member's row existing with the right id, used immediately in the membership insert).
- `getMembership()` gained `subscriptionId` in its selected columns (additive, no existing caller broken).
- The add-member panel always renders (create-new is always available); the "Người có sẵn" radio option is hidden entirely, not just disabled, when no eligible existing member remains — matches the plan's "never blocks the page" requirement.
- One thing not spelled out in the plan and decided during implementation: `updateMembership`/`setMembershipArchived` redirect to the membership detail page (`/admin/memberships/{id}`), not the subscription page, since the admin is mid-edit on that specific person and archiving doesn't remove the row.

## Risk Assessment

- `.returning()` is new to this codebase (D1/SQLite supports it, but verify with a real local-D1 insert rather than trusting the type signature).
- Redirect-target changes touch 3 existing actions (`updateMembership`, `setMembershipArchived`, `deleteMembership`) — re-verify each one end to end, not just the new action, since a stale redirect to a now-deleted list page would silently 404 after a successful save.
