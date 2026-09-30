import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Domain tables first, then Better Auth tables and the login throttle.
// Conventions:
//  - Dates (`paid_through`, `due_date`, `date`) are 'YYYY-MM-DD' text, JST calendar days.
//  - Money is an integer in the currency's whole unit (JPY and VND have no minor unit).
//  - Timestamps are integer epoch ms.

export const CURRENCIES = ['JPY', 'VND'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const PAYMENT_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REMINDER_KINDS = [
  't-minus',
  't0',
  'overdue-1',
  'overdue-2',
  'overdue-3',
  'overdue-4',
  'overdue-5',
  'manual',
] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));

export const paymentAccounts = sqliteTable(
  'payment_accounts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Currency doubles as the country: JPY = Japan account fields, VND = Vietnam account fields.
    currency: text('currency').notNull(),
    label: text('label').notNull(),
    bankName: text('bank_name').notNull(),
    // Japan only (e.g. 支店名); NULL for VND accounts.
    branchName: text('branch_name'),
    accountNumber: text('account_number').notNull(),
    accountHolderName: text('account_holder_name').notNull(),
    // Vietnam only, optional: path to a static QR image under public/ (e.g. "/qr/vcb.png").
    // The file itself is a project asset, added to the repo — no upload, no object storage.
    qrImagePath: text('qr_image_path'),
  },
  (t) => [
    check('payment_accounts_currency_check', sql`${t.currency} IN (${inList(CURRENCIES)})`),
    check(
      'payment_accounts_country_fields_check',
      sql`(${t.currency} = 'JPY' AND ${t.qrImagePath} IS NULL) OR (${t.currency} = 'VND' AND ${t.branchName} IS NULL)`,
    ),
  ],
);

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    currency: text('currency').notNull(),
    // How the admin entered the price: 'monthly' -> billingAmount is the monthly total;
    // 'yearly' -> billingAmount is the yearly total. Entered as-is, never converted; a
    // "per month / per year, per person" reference is computed on read (see
    // lib/format/subscription-reference.ts), never stored.
    billingCycle: text('billing_cycle').notNull().default('monthly'),
    billingAmount: integer('billing_amount').notNull(),
    // How many *other* people can share it, not counting the admin (0 = nobody else yet);
    // used only for the reference calculation above (headcount is slotCount + 1).
    slotCount: integer('slot_count').notNull().default(0),
    // Days before due to send the first reminder; NULL means the app default (7).
    remindDaysBefore: integer('remind_days_before'),
  },
  (t) => [
    check('subscriptions_currency_check', sql`${t.currency} IN (${inList(CURRENCIES)})`),
    check('subscriptions_billing_cycle_check', sql`${t.billingCycle} IN (${inList(BILLING_CYCLES)})`),
    check('subscriptions_billing_amount_check', sql`${t.billingAmount} > 0`),
    check('subscriptions_slot_count_check', sql`${t.slotCount} >= 0`),
    check('subscriptions_remind_check', sql`${t.remindDaysBefore} IS NULL OR ${t.remindDaysBefore} >= 0`),
  ],
);

// A subscription can be paid into more than one account (e.g. a JPY e-wallet and a VND bank
// account), so members abroad and at home can each pay in a currency that's convenient for them.
export const subscriptionPaymentAccounts = sqliteTable(
  'subscription_payment_accounts',
  {
    subscriptionId: integer('subscription_id')
      .notNull()
      .references(() => subscriptions.id),
    paymentAccountId: integer('payment_account_id')
      .notNull()
      .references(() => paymentAccounts.id),
  },
  (t) => [primaryKey({ columns: [t.subscriptionId, t.paymentAccountId] })],
);

export const members = sqliteTable('members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  // Stored lowercase; login matches on it.
  email: text('email').notNull().unique(),
  userId: text('user_id'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const memberships = sqliteTable(
  'memberships',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id),
    subscriptionId: integer('subscription_id')
      .notNull()
      .references(() => subscriptions.id),
    // Currency this member actually pays in, independent of the subscription's billing currency:
    // a VND-billed subscription can collect JPY from a member living in Japan.
    currency: text('currency').notNull(),
    // Amount per billing period of the subscription's cycle, in this membership's own currency.
    monthlyShare: integer('monthly_share').notNull(),
    isFamily: integer('is_family', { mode: 'boolean' }).notNull().default(false),
    // Paid up to (and including the day before) this date; also the next due date.
    paidThrough: text('paid_through').notNull(),
    // Admin-only note about this member within this subscription (never shown to the member).
    memo: text('memo'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    uniqueIndex('memberships_member_subscription_uq').on(t.memberId, t.subscriptionId),
    check('memberships_currency_check', sql`${t.currency} IN (${inList(CURRENCIES)})`),
    check('memberships_share_check', sql`${t.monthlyShare} >= 0`),
  ],
);

export const payments = sqliteTable(
  'payments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    membershipId: integer('membership_id')
      .notNull()
      .references(() => memberships.id),
    monthsCovered: integer('months_covered').notNull(),
    amount: integer('amount').notNull(),
    status: text('status').notNull().default('pending'),
    note: text('note'),
    rejectReason: text('reject_reason'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    decidedAt: integer('decided_at', { mode: 'timestamp_ms' }),
  },
  (t) => [
    index('payments_membership_idx').on(t.membershipId),
    // A member can have at most one unreviewed request per membership.
    uniqueIndex('payments_one_pending_uq').on(t.membershipId).where(sql`${t.status} = 'pending'`),
    check('payments_status_check', sql`${t.status} IN (${inList(PAYMENT_STATUSES)})`),
    check('payments_months_check', sql`${t.monthsCovered} >= 1`),
    check('payments_amount_check', sql`${t.amount} > 0`),
  ],
);

export const reminderLog = sqliteTable(
  'reminder_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    membershipId: integer('membership_id')
      .notNull()
      .references(() => memberships.id),
    dueDate: text('due_date').notNull(),
    kind: text('kind').notNull(),
    sentAt: integer('sent_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    // Cron milestones send once per (membership, due date); manual sends may repeat.
    uniqueIndex('reminder_log_once_uq')
      .on(t.membershipId, t.dueDate, t.kind)
      .where(sql`${t.kind} != 'manual'`),
    check('reminder_log_kind_check', sql`${t.kind} IN (${inList(REMINDER_KINDS)})`),
  ],
);

export const fxRates = sqliteTable(
  'fx_rates',
  {
    date: text('date').notNull(),
    base: text('base').notNull(),
    quote: text('quote').notNull(),
    rate: real('rate').notNull(),
  },
  (t) => [primaryKey({ columns: [t.date, t.base, t.quote] }), check('fx_rates_rate_check', sql`${t.rate} > 0`)],
);

// ---- Better Auth tables ----
// Date fields use integer(timestamp_ms) so Drizzle converts JS Date <-> integer (D1 rejects Date objects).

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default(''),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }),
});

// Cooldown for login emails: one row per allowed email, last send time in epoch ms.
export const loginThrottle = sqliteTable('login_throttle', {
  email: text('email').primaryKey(),
  lastSentAt: integer('last_sent_at').notNull(),
});
