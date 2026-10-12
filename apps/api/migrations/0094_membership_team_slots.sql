DROP INDEX `owner_teams_profile_season_unique`;--> statement-breakpoint
ALTER TABLE `owner_teams` ADD `slot` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `owner_teams_profile_season_slot_unique` ON `owner_teams` (`profile_id`,`season`,`slot`);
--> statement-breakpoint
DROP INDEX `owner_teams_season_ovr_idx`;
--> statement-breakpoint
CREATE INDEX `owner_teams_season_ovr_idx` ON `owner_teams` (`season`,`slot`,`ovr`);
--> statement-breakpoint
DROP INDEX `owner_teams_season_rating_idx`;
--> statement-breakpoint
CREATE INDEX `owner_teams_season_rating_idx` ON `owner_teams` (`season`,`slot`,`rating`);
