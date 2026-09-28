PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`billing_amount` integer NOT NULL,
	`price_per_month` integer NOT NULL,
	`payment_account_id` integer NOT NULL,
	`remind_days_before` integer,
	FOREIGN KEY (`payment_account_id`) REFERENCES `payment_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "subscriptions_currency_check" CHECK("__new_subscriptions"."currency" IN ('JPY', 'VND')),
	CONSTRAINT "subscriptions_billing_cycle_check" CHECK("__new_subscriptions"."billing_cycle" IN ('monthly', 'yearly')),
	CONSTRAINT "subscriptions_billing_amount_check" CHECK("__new_subscriptions"."billing_amount" > 0),
	CONSTRAINT "subscriptions_price_check" CHECK("__new_subscriptions"."price_per_month" > 0),
	CONSTRAINT "subscriptions_remind_check" CHECK("__new_subscriptions"."remind_days_before" IS NULL OR "__new_subscriptions"."remind_days_before" >= 0)
);
--> statement-breakpoint
-- Existing rows had only a monthly price; billing_cycle defaults to 'monthly' and
-- billing_amount is exactly that price (a 1:1 carry-over, not a placeholder).
INSERT INTO `__new_subscriptions`("id", "name", "currency", "billing_cycle", "billing_amount", "price_per_month", "payment_account_id", "remind_days_before")
  SELECT "id", "name", "currency", 'monthly', "price_per_month", "price_per_month", "payment_account_id", "remind_days_before" FROM `subscriptions`;--> statement-breakpoint
DROP TABLE `subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_subscriptions` RENAME TO `subscriptions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;