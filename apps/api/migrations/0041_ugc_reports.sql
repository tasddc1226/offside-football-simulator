CREATE TABLE `board_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`blocked_profile_id` text NOT NULL,
	`nickname` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `board_blocks_pair_unique` ON `board_blocks` (`profile_id`,`blocked_profile_id`);--> statement-breakpoint
CREATE INDEX `board_blocks_blocked_idx` ON `board_blocks` (`blocked_profile_id`);--> statement-breakpoint
CREATE TABLE `board_comment_reports` (
	`comment_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`comment_id`, `profile_id`),
	FOREIGN KEY (`comment_id`) REFERENCES `board_comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `board_comment_reports_profile_idx` ON `board_comment_reports` (`profile_id`);--> statement-breakpoint
CREATE TABLE `name_reports` (
	`kind` text NOT NULL,
	`target_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text,
	PRIMARY KEY(`kind`, `target_id`, `profile_id`)
);
--> statement-breakpoint
CREATE INDEX `name_reports_resolved_idx` ON `name_reports` (`resolved_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `name_reports_profile_idx` ON `name_reports` (`profile_id`);--> statement-breakpoint
ALTER TABLE `careers` ADD `name_hidden_at` text;