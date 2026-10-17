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