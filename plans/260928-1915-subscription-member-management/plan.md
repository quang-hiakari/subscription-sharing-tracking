---
title: Subscription-Centric Member Management
description: >-
  Move member management into the subscription detail page; add a yearly-price
  entry helper
status: completed
priority: P2
branch: main
tags:
  - admin-ux
  - nextjs
blockedBy: []
blocks: []
created: '2026-09-28T10:23:40.381Z'
createdBy: 'ck:plan'
source: skill
---

# Subscription-Centric Member Management

## Overview

Root cause of "không add user vô subscription được": `/admin/subscriptions/[id]` has no member list and no add-member action. Adding a member is a disconnected top-level flow (`/admin/memberships/new`) with two unrelated dropdowns, blocked entirely if no member exists yet. `is_family` is already correctly modeled per-membership (not per-member) — no schema change needed for that part.

This plan: (1) make the subscription detail page the place where members are listed and added — pick an existing member or create one inline, in one action; retire the standalone list/new membership screens; (2) add a UI-only yearly-price helper to the subscription price field (no schema change, per user decision).

Builds on [Admin CRUD](../260921-1002-subscription-sharing-tracker/phase-03-admin-crud.md) from the main tracker plan (phase completed; this revises its UX, not blocked by it).

## Key decisions (from user)

- Yearly price is a UI convenience only: typing a yearly amount fills the existing `pricePerMonth` field (rounded, ÷12); no `billing_cycle` column, no schema change.
- The membership list screen (`/admin/memberships` + nav item) is removed; its content moves into each subscription's detail page.
- New-member form embedded in the add-flow: name + email only (matches the existing member-creation form).
- Per-membership detail page (`/admin/memberships/[id]`, history/reminders/record-payment) stays — it's not "the list", it's where deeper per-member actions live; subscription detail links to it.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Subscription member management](./phase-01-subscription-member-management.md) | Completed |
| 2 | [Yearly price helper](./phase-02-yearly-price-helper.md) | Completed |

Order: 1 → 2 (independent; 2 can be done first if preferred, no dependency).

## Acceptance criteria

- From `/admin/subscriptions/[id]`, admin adds a member (existing or brand new) without leaving the page, sets their monthly share and family flag there.
- A member already in that subscription cannot be re-added (clear error); an email already used by another member cannot create a duplicate.
- Nav has no "Thành viên trong sub" item; visiting `/admin/memberships` (list) and `/admin/memberships/new` returns 404 or redirects — no dead links from the app itself.
- `/admin/memberships/[id]` (per-membership detail: history, reminder, record payment, archive/delete) still works, linked from the subscription page.
- Subscription price field still stores a monthly integer in `pricePerMonth`; typing a yearly amount fills it correctly rounded; the field remains directly editable.
- No regression to phases 3-6 of the main tracker plan (payment approval, reminders, FX display) — they read `pricePerMonth`/`monthlyShare` unchanged.

## Dependencies

None blocking. Touches the same files as the main tracker plan's phase 3 (already completed).

## Open questions

None.
