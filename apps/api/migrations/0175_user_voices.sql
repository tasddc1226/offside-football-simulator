CREATE TABLE `user_voices` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`body_key` text NOT NULL,
	`screen` text,
	`platform` text NOT NULL,
	`app_version` text NOT NULL,
	`device` text,
	`lang` text NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_voices_profile_body_unique` ON `user_voices` (`profile_id`,`body_key`);--> statement-breakpoint
CREATE INDEX `user_voices_open_idx` ON `user_voices` (`resolved_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_voices_created_idx` ON `user_voices` (`created_at`);