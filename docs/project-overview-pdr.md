# Project Overview and Requirements

## Problem

The owner shares YouTube and Microsoft 365 with several people and collects their share by hand. There is no record of who paid until when, reminders are manual, and amounts are in JPY or VND. Some people are family and must never be chased.

## Requirements

- **Roles.** Admin (full control) and member (read-only plus "I paid"). No open sign-up: only `ADMIN_EMAILS` and active members can sign in.
- **Billing model.** Each subscription has one currency (JPY or VND), a billing cycle (monthly or yearly) and a total amount for that cycle, plus a slot count used only to show reference numbers (per-person cost). Each member's own share is entered manually by the admin, in the subscription's own cycle unit and in whichever currency that member actually pays (JPY or VND, independent of the subscription's). A payment covers 1-36 periods of that cycle, so the due date is a single `paid_through` date per membership that moves forward — by 1 month per period (monthly) or 12 months per period (yearly) — when a payment is approved.
- **Payments.** A member reports a payment (months, optional amount, note) -> admin approves or rejects (reason required). Admin can also record money received directly.
- **Reminders.** Email T-N days before the due date (N per subscription, default 7), on the due date, then every 3 overdue days, at most 5. Never for family members. Admin can send one now.
- **Currency display.** On admin screens amounts show in their own currency plus a "≈" value in the other, from a daily rate. Display only; never used for billing. Members see only the exact amount the admin entered, with no conversion.
- **Access.** Members sign in with a magic link or a 6-digit code (mail scanners can consume one-time links). Security is intentionally light: the data is dues and dates.
- **Language.** Vietnamese only.

## Out of scope

Receipt upload, i18n, bank auto-detection, online payment, fully custom reminder schedules, multiple admins with different rights. Automatic conversion between currencies is also out of scope: when a member pays in another currency than the subscription, the admin types that member's amount themselves (the "≈" rate is a reference only).

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
