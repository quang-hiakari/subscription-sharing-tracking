CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`date` text NOT NULL,
	`base` text NOT NULL,
	`quote` text NOT NULL,
	`rate` real NOT NULL,
	PRIMARY KEY(`date`, `base`, `quote`),
	CONSTRAINT "fx_rates_rate_check" CHECK("fx_rates"."rate" > 0)
);
--> statement-breakpoint
CREATE TABLE `login_throttle` (
	`email` text PRIMARY KEY NOT NULL,
	`last_sent_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`subscription_id` integer NOT NULL,
	`monthly_share` integer NOT NULL,
	`is_family` integer DEFAULT false NOT NULL,
	`paid_through` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "memberships_share_check" CHECK("memberships"."monthly_share" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_member_subscription_uq` ON `memberships` (`member_id`,`subscription_id`);--> statement-breakpoint
CREATE TABLE `payment_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`currency` text NOT NULL,
	`label` text NOT NULL,
	`bank_name` text NOT NULL,
	`branch_name` text,
	`account_number` text NOT NULL,
	`account_holder_name` text NOT NULL,
	`qr_image_path` text,
	CONSTRAINT "payment_accounts_currency_check" CHECK("payment_accounts"."currency" IN ('JPY', 'VND')),
	CONSTRAINT "payment_accounts_country_fields_check" CHECK(("payment_accounts"."currency" = 'JPY' AND "payment_accounts"."qr_image_path" IS NULL) OR ("payment_accounts"."currency" = 'VND' AND "payment_accounts"."branch_name" IS NULL))
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`membership_id` integer NOT NULL,
	`months_covered` integer NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text,
	`reject_reason` text,
	`created_at` integer NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payments_status_check" CHECK("payments"."status" IN ('pending', 'approved', 'rejected')),
	CONSTRAINT "payments_months_check" CHECK("payments"."months_covered" >= 1),
	CONSTRAINT "payments_amount_check" CHECK("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE INDEX `payments_membership_idx` ON `payments` (`membership_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_one_pending_uq` ON `payments` (`membership_id`) WHERE "payments"."status" = 'pending';--> statement-breakpoint
CREATE TABLE `reminder_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`membership_id` integer NOT NULL,
	`due_date` text NOT NULL,
	`kind` text NOT NULL,
	`sent_at` integer NOT NULL,
	FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reminder_log_kind_check" CHECK("reminder_log"."kind" IN ('t-minus', 't0', 'overdue-1', 'overdue-2', 'overdue-3', 'overdue-4', 'overdue-5', 'manual'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_log_once_uq` ON `reminder_log` (`membership_id`,`due_date`,`kind`) WHERE "reminder_log"."kind" != 'manual';--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`billing_amount` integer NOT NULL,
	`slot_count` integer DEFAULT 1 NOT NULL,
	`payment_account_id` integer NOT NULL,
	`remind_days_before` integer,
	FOREIGN KEY (`payment_account_id`) REFERENCES `payment_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "subscriptions_currency_check" CHECK("subscriptions"."currency" IN ('JPY', 'VND')),
	CONSTRAINT "subscriptions_billing_cycle_check" CHECK("subscriptions"."billing_cycle" IN ('monthly', 'yearly')),
	CONSTRAINT "subscriptions_billing_amount_check" CHECK("subscriptions"."billing_amount" > 0),
	CONSTRAINT "subscriptions_slot_count_check" CHECK("subscriptions"."slot_count" > 0),
	CONSTRAINT "subscriptions_remind_check" CHECK("subscriptions"."remind_days_before" IS NULL OR "subscriptions"."remind_days_before" >= 0)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
