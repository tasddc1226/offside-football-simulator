CREATE TABLE `owner_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`formation` text NOT NULL,
	`slots_json` text NOT NULL,
	`filled` integer NOT NULL,
	`ovr` integer NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`draws` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `owner_teams_profile_idx` ON `owner_teams` (`profile_id`);--> statement-breakpoint
CREATE INDEX `owner_teams_ovr_idx` ON `owner_teams` (`ovr`);--> statement-breakpoint
CREATE TABLE `team_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`home_team_id` text NOT NULL,
	`away_team_id` text NOT NULL,
	`home_goals` integer NOT NULL,
	`away_goals` integer NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`home_team_id`) REFERENCES `owner_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`away_team_id`) REFERENCES `owner_teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_matches_profile_created_idx` ON `team_matches` (`profile_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `team_matches_away_created_idx` ON `team_matches` (`away_team_id`,`created_at`);