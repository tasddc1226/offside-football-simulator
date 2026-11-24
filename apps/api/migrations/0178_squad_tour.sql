CREATE TABLE `tour_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`week` text NOT NULL,
	`stage` integer NOT NULL,
	`day` text NOT NULL,
	`try_no` integer NOT NULL,
	`status` text NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`state_json` text NOT NULL,
	`created_at` text NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tour_matches_profile_day_idx` ON `tour_matches` (`profile_id`,`day`);--> statement-breakpoint
CREATE UNIQUE INDEX `tour_matches_live_idx` ON `tour_matches` (`profile_id`) WHERE "tour_matches"."status" = 'live';--> statement-breakpoint
CREATE TABLE `tour_progress` (
	`profile_id` text NOT NULL,
	`week` text NOT NULL,
	`cleared` integer DEFAULT 0 NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`tries` integer DEFAULT 0 NOT NULL,
	`tries_at_score` integer DEFAULT 0 NOT NULL,
	`reached_at` text,
	`stars_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`profile_id`, `week`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tour_progress_rank_idx` ON `tour_progress` (`week`,`score`,`tries_at_score`,`reached_at`);