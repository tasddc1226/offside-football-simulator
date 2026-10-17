CREATE TABLE `acquisition_consents` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`granted_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `acquisition_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`campaign` text NOT NULL,
	`received_at` text NOT NULL,
	`linked_at` text,
	`started_at` text,
	`store_clicked_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `acquisition_sessions_profile_time_idx` ON `acquisition_sessions` (`profile_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `acquisition_sessions_time_idx` ON `acquisition_sessions` (`received_at`);--> statement-breakpoint
CREATE TABLE `iap_ad_free_purchases` (
	`store` text NOT NULL,
	`transaction_id` text NOT NULL,
	`profile_id` text,
	`product_id` text NOT NULL,
	`test` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`purchased_at` text,
	`price_milliunits` integer,
	`currency` text,
	`storefront` text,
	`refunded_at` text,
	`first_touch_id` text,
	`last_touch_id` text,
	PRIMARY KEY(`store`, `transaction_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`first_touch_id`) REFERENCES `acquisition_sessions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`last_touch_id`) REFERENCES `acquisition_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `iap_ad_free_profile_idx` ON `iap_ad_free_purchases` (`profile_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `iap_ad_free_created_idx` ON `iap_ad_free_purchases` (`created_at`);--> statement-breakpoint
CREATE INDEX `iap_ad_free_refunded_idx` ON `iap_ad_free_purchases` (`refunded_at`);--> statement-breakpoint
CREATE INDEX `iap_ad_free_first_idx` ON `iap_ad_free_purchases` (`first_touch_id`);--> statement-breakpoint
CREATE INDEX `iap_ad_free_last_idx` ON `iap_ad_free_purchases` (`last_touch_id`);--> statement-breakpoint
CREATE TABLE `iap_refund_markers` (
	`store` text NOT NULL,
	`transaction_id` text NOT NULL,
	`refunded_at` text NOT NULL,
	PRIMARY KEY(`store`, `transaction_id`)
);
--> statement-breakpoint
ALTER TABLE `iap_purchases` ADD `purchased_at` text;--> statement-breakpoint
ALTER TABLE `iap_purchases` ADD `price_milliunits` integer;--> statement-breakpoint
ALTER TABLE `iap_purchases` ADD `currency` text;--> statement-breakpoint
ALTER TABLE `iap_purchases` ADD `storefront` text;--> statement-breakpoint
ALTER TABLE `iap_purchases` ADD `first_touch_id` text REFERENCES acquisition_sessions(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `iap_purchases` ADD `last_touch_id` text REFERENCES acquisition_sessions(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `iap_purchases_effective_time_idx` ON `iap_purchases` (coalesce("purchased_at", "created_at"));--> statement-breakpoint
CREATE INDEX `iap_purchases_refunded_idx` ON `iap_purchases` (`refunded_at`);--> statement-breakpoint
CREATE INDEX `iap_purchases_first_touch_idx` ON `iap_purchases` (`first_touch_id`);--> statement-breakpoint
CREATE INDEX `iap_purchases_last_touch_idx` ON `iap_purchases` (`last_touch_id`);