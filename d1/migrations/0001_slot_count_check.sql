-- slot_count now means "extra sharers, not counting the admin" (0 is valid); relax the CHECK
-- from > 0 to >= 0 and change the default from 1 to 0. SQLite can't ALTER a CHECK constraint
-- directly, so this recreates the table (data preserved as-is; the app already stopped
-- interpreting slot_count as "total headcount" for anyone who created rows on either schema).
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`billing_amount` integer NOT NULL,
	`slot_count` integer DEFAULT 0 NOT NULL,
	`remind_days_before` integer,
	CONSTRAINT "subscriptions_currency_check" CHECK("__new_subscriptions"."currency" IN ('JPY', 'VND')),
	CONSTRAINT "subscriptions_billing_cycle_check" CHECK("__new_subscriptions"."billing_cycle" IN ('monthly', 'yearly')),
	CONSTRAINT "subscriptions_billing_amount_check" CHECK("__new_subscriptions"."billing_amount" > 0),
	CONSTRAINT "subscriptions_slot_count_check" CHECK("__new_subscriptions"."slot_count" >= 0),
	CONSTRAINT "subscriptions_remind_check" CHECK("__new_subscriptions"."remind_days_before" IS NULL OR "__new_subscriptions"."remind_days_before" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_subscriptions`("id", "name", "currency", "billing_cycle", "billing_amount", "slot_count", "remind_days_before")
  SELECT "id", "name", "currency", "billing_cycle", "billing_amount", "slot_count", "remind_days_before" FROM `subscriptions`;
--> statement-breakpoint
DROP TABLE `subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_subscriptions` RENAME TO `subscriptions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
