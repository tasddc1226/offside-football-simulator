CREATE TABLE `team_comment_reports` (
	`comment_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`comment_id`, `profile_id`),
	FOREIGN KEY (`comment_id`) REFERENCES `team_comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_comment_reports_profile_idx` ON `team_comment_reports` (`profile_id`);--> statement-breakpoint
CREATE TABLE `team_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`nickname` text NOT NULL,
	`body` text NOT NULL,
	`admin` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`team_id`) REFERENCES `owner_teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_comments_team_created_idx` ON `team_comments` (`team_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `team_comments_profile_idx` ON `team_comments` (`profile_id`);--> statement-breakpoint
CREATE INDEX `team_comments_created_idx` ON `team_comments` (`created_at`);