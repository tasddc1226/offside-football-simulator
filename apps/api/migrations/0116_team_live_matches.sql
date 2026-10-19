CREATE TABLE `team_live_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`home_team_id` text NOT NULL,
	`away_team_id` text NOT NULL,
	`state_json` text NOT NULL,
	`rev` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`done_at` text,
	`result_json` text,
	FOREIGN KEY (`home_team_id`) REFERENCES `owner_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`away_team_id`) REFERENCES `owner_teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_live_matches_profile_idx` ON `team_live_matches` (`profile_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `team_live_matches_open_idx` ON `team_live_matches` (`done_at`,`created_at`);