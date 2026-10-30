ALTER TABLE `owner_teams` ADD `lineup_value_open` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_teams` ADD `lineup_value_closed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `owner_teams_season_value_open_idx` ON `owner_teams` (`season`,`lineup_value_open`,`rating`,`created_at`);--> statement-breakpoint
CREATE INDEX `owner_teams_season_value_closed_idx` ON `owner_teams` (`season`,`lineup_value_closed`,`rating`,`created_at`);