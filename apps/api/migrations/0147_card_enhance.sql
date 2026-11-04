CREATE TABLE `card_enhance_log` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`career_id` text NOT NULL,
	`request_key` text NOT NULL,
	`from_level` integer NOT NULL,
	`to_level` integer NOT NULL,
	`fails` integer NOT NULL,
	`success` integer NOT NULL,
	`rate_bp` integer NOT NULL,
	`down_bp` integer NOT NULL,
	`roll` integer NOT NULL,
	`cost` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_enhance_log_request_unique` ON `card_enhance_log` (`profile_id`,`request_key`);--> statement-breakpoint
CREATE INDEX `card_enhance_log_profile_idx` ON `card_enhance_log` (`profile_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `card_enhance_log_career_idx` ON `card_enhance_log` (`career_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `cards` ADD `enhance` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cards` ADD `enhance_fails` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_title_progress` ADD `enhance_tries` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_title_progress` ADD `enhance_keeps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_title_progress` ADD `enhance_downs` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_title_progress` ADD `enhance_near` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_title_progress` ADD `enhance_spent` integer DEFAULT 0 NOT NULL;