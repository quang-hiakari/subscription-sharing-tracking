PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payment_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`currency` text NOT NULL,
	`label` text NOT NULL,
	`bank_name` text NOT NULL,
	`branch_name` text,
	`account_number` text NOT NULL,
	`account_holder_name` text NOT NULL,
	`qr_image_path` text,
	CONSTRAINT "payment_accounts_currency_check" CHECK("__new_payment_accounts"."currency" IN ('JPY', 'VND')),
	CONSTRAINT "payment_accounts_country_fields_check" CHECK(("__new_payment_accounts"."currency" = 'JPY' AND "__new_payment_accounts"."qr_image_path" IS NULL) OR ("__new_payment_accounts"."currency" = 'VND' AND "__new_payment_accounts"."branch_name" IS NULL))
);
--> statement-breakpoint
-- payment_accounts previously stored one free-text `details` blob; there is no structured source
-- for bank_name/account_number/account_holder_name, so existing rows get a placeholder that makes
-- the missing info obvious in the admin UI. Re-enter these accounts' details after this migration.
INSERT INTO `__new_payment_accounts`("id", "currency", "label", "bank_name", "branch_name", "account_number", "account_holder_name", "qr_image_path")
  SELECT "id", "currency", "label", '(cần cập nhật)', NULL, '(cần cập nhật)', '(cần cập nhật)', NULL FROM `payment_accounts`;--> statement-breakpoint
DROP TABLE `payment_accounts`;--> statement-breakpoint
ALTER TABLE `__new_payment_accounts` RENAME TO `payment_accounts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;