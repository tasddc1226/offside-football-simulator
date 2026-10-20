CREATE TABLE `league_entries` (
	`season` integer NOT NULL,
	`profile_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`team_id` text,
	`name` text,
	`manager` text,
	`ovr` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`season`, `profile_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `league_entries_profile_idx` ON `league_entries` (`profile_id`);--> statement-breakpoint
CREATE INDEX `league_entries_season_status_idx` ON `league_entries` (`season`,`status`);--> statement-breakpoint
CREATE TABLE `league_seasons` (
	`season` integer PRIMARY KEY NOT NULL,
	`starts_at` text NOT NULL,
	`opens_at` text NOT NULL,
	`closes_at` text NOT NULL,
	`draw_at` text NOT NULL,
	`rounds_json` text NOT NULL,
	`min_filled` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
