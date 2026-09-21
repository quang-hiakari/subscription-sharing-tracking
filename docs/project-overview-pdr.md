# Project Overview and Requirements

## Problem

The owner shares YouTube and Microsoft 365 with several people and collects their share by hand. There is no record of who paid until when, reminders are manual, and amounts are in JPY or VND. Some people are family and must never be chased.

## Requirements

- **Roles.** Admin (full control) and member (read-only plus "I paid"). No open sign-up: only `ADMIN_EMAILS` and active members can sign in.
- **Billing model.** Each subscription has one currency (JPY or VND) and a price per month. Each member has a monthly share. A payment covers 1-36 months, so the due date is a single `paid_through` date per membership that moves forward when a payment is approved.
- **Payments.** A member reports a payment (months, optional amount, note) -> admin approves or rejects (reason required). Admin can also record money received directly.
- **Reminders.** Email T-N days before the due date (N per subscription, default 7), on the due date, then every 3 overdue days, at most 5. Never for family members. Admin can send one now.
- **Currency display.** Amounts show in their own currency plus a "≈" value in the other, from a daily rate. Display only; never used for billing.
- **Access.** Members sign in with a magic link or a 6-digit code (mail scanners can consume one-time links). Security is intentionally light: the data is dues and dates.
- **Language.** Vietnamese only.

## Out of scope

Billing in a currency other than the subscription's, receipt upload, i18n, bank auto-detection, online payment, fully custom reminder schedules, multiple admins with different rights.

## Decisions worth remembering

| Decision | Why |
|---|---|
| Due date is `paid_through`, not fixed periods | Members prepay 1, 6 or 12 months; a period model breaks. |
| Separate cron Worker | Cloudflare Pages has no cron triggers. |
| Magic link + code in the same email | Outlook/M365 link scanners can burn a one-time link. |
| Archive instead of delete once there is history | Keeps the financial trail; archived people cannot sign in and get no reminders. |
| FX from `open.er-api.com` | No key, daily, has VND (the ECB feed has none). Requires attribution. |

## Success criteria

- Each non-family member gets each reminder milestone exactly once per due date; family never.
- A 12-month prepayment moves `paid_through` by 12 months and shifts the next reminder.
- A member sees only their own memberships and cannot reach admin pages or actions.
- Amounts show the native currency and a "≈" value with the rate date.
- A manual reminder is logged and the daily cron does not repeat it the same day.

The full record of how each was verified is in `plans/260921-1002-subscription-sharing-tracker/`.
