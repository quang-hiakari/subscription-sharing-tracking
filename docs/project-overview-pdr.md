# Project Overview and Requirements

## Problem

The owner shares YouTube and Microsoft 365 with several people and collects their share by hand. There is no record of who paid until when, reminders are manual, and amounts are in JPY or VND. Some people are family and must never be chased.

## Requirements

- **Roles.** Admin (full control) and member (read-only plus "I paid"). No open sign-up: only `ADMIN_EMAILS` and active members can sign in.
- **Billing model.** Each subscription has one currency (JPY or VND), a billing cycle (monthly or yearly) and a total amount for that cycle, plus a slot count used only to show reference numbers (per-person cost), and one or more payment accounts it can be paid into. Each member's own share is entered manually by the admin, in the subscription's own cycle unit and in whichever currency that member actually pays (JPY or VND, independent of the subscription's or any account's).
- **Payments.** A member reports a payment (periods, optional amount, note) -> admin approves (optionally overriding the number of periods credited — a quick 6-month/1-year preset, or any other number via its own checkbox, e.g. when the member typed 1 by mistake for a bulk transfer) or rejects (reason required). Admin can also record money received directly. A payment covers 1-36 periods of the subscription's cycle, so the due date is a single `paid_through` date per membership that moves forward — by 1 month per period (monthly) or 12 months per period (yearly) — when a payment is approved. For a monthly subscription, reminder emails also show what 6 or 12 months upfront would cost, since some people prefer to pay ahead.
- **Reminders.** Email T-N days before the due date (N per subscription, default 7), on the due date, then every 3 overdue days, at most 5. Never for family members. Admin can send one now. Shows every one of the subscription's payment accounts, each with the amount converted to that account's own currency (from a daily rate), so the member can pay in whichever currency is convenient.
- **Currency display.** Amounts show in their own currency plus a "≈" value in the other, from a daily rate, both on admin screens and to members. Display only; the amount owed is always what the admin entered — conversion never changes it, only which currency to send.
- **Access.** Members sign in with a magic link or a 6-digit code (mail scanners can consume one-time links). Security is intentionally light: the data is dues and dates.
- **Language.** Vietnamese only.

## Out of scope

Receipt upload, i18n, bank auto-detection, online payment, fully custom reminder schedules, multiple admins with different rights. A member's own share amount is always typed by the admin, never computed from an FX rate — the daily rate is used only to show what that amount comes out to for display and for choosing which of the subscription's accounts/currencies to pay into, never to set what anyone owes.

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
