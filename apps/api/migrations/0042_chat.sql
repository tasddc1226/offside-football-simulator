CREATE TABLE `chat_mutes` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`until` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_mutes_until_idx` ON `chat_mutes` (`until`);--> statement-breakpoint
CREATE TABLE `chat_reports` (
	`message_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`reason` text NOT NULL,
	`author_profile_id` text NOT NULL,
	`nickname` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text,
	PRIMARY KEY(`message_id`, `profile_id`)
);
--> statement-breakpoint
CREATE INDEX `chat_reports_created_idx` ON `chat_reports` (`created_at`);--> statement-breakpoint
CREATE INDEX `chat_reports_open_idx` ON `chat_reports` (`resolved_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `chat_reports_profile_idx` ON `chat_reports` (`profile_id`);--> statement-breakpoint
CREATE INDEX `chat_reports_author_idx` ON `chat_reports` (`author_profile_id`);