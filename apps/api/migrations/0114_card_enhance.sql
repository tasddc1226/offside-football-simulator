CREATE TABLE `card_enhance_log` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`career_id` text NOT NULL,
	`from_level` integer NOT NULL,
	`to_level` integer NOT NULL,
	`success` integer NOT NULL,
	`rate_bp` integer NOT NULL,
	`roll` integer NOT NULL,
	`cost` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `card_enhance_log_profile_idx` ON `card_enhance_log` (`profile_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `card_enhance_log_big_idx` ON `card_enhance_log` (`created_at`) WHERE "card_enhance_log"."success" = 1 AND "card_enhance_log"."to_level" >= 8;--> statement-breakpoint
ALTER TABLE `cards` ADD `enhance` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cards` ADD `enhance_fails` integer DEFAULT 0 NOT NULL;