CREATE TABLE `league_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`season` integer NOT NULL,
	`tier` integer NOT NULL,
	`league_no` integer NOT NULL,
	`round` integer NOT NULL,
	`slot` integer NOT NULL,
	`home_team_id` text NOT NULL,
	`away_team_id` text NOT NULL,
	`at` text NOT NULL,
	`played_at` text,
	`home_goals` integer,
	`away_goals` integer,
	`forfeit` integer DEFAULT 0 NOT NULL,
	`detail_json` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `league_matches_slot_unique` ON `league_matches` (`season`,`tier`,`league_no`,`round`,`slot`);--> statement-breakpoint
CREATE INDEX `league_matches_season_at_idx` ON `league_matches` (`season`,`at`);--> statement-breakpoint
CREATE INDEX `league_matches_home_team_idx` ON `league_matches` (`home_team_id`);--> statement-breakpoint
CREATE INDEX `league_matches_away_team_idx` ON `league_matches` (`away_team_id`);--> statement-breakpoint
CREATE TABLE `league_state` (
	`season` integer PRIMARY KEY NOT NULL,
	`seed` text NOT NULL,
	`tiers_json` text NOT NULL,
	`drawn_at` text NOT NULL,
	`done_at` text
);
--> statement-breakpoint
ALTER TABLE `league_entries` ADD `tier` integer;--> statement-breakpoint
ALTER TABLE `league_entries` ADD `league_no` integer;--> statement-breakpoint
ALTER TABLE `league_entries` ADD `forfeits` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `league_entries` ADD `notified_round` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `league_entries_season_league_idx` ON `league_entries` (`season`,`tier`,`league_no`);