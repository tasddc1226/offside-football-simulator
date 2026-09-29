CREATE TABLE `team_likes` (
	`team_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`team_id`, `profile_id`),
	FOREIGN KEY (`team_id`) REFERENCES `owner_teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_likes_profile_idx` ON `team_likes` (`profile_id`);--> statement-breakpoint
DROP INDEX `owner_teams_profile_idx`;--> statement-breakpoint
DROP INDEX `owner_teams_ovr_idx`;--> statement-breakpoint
ALTER TABLE `owner_teams` ADD `season` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_teams` ADD `manager` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_teams` ADD `rating` integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_teams` ADD `goals_for` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_teams` ADD `goals_against` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_teams` ADD `streak` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_teams` ADD `best_streak` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_teams` ADD `best_margin` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_teams` ADD `likes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_teams` ADD `views` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `owner_teams_profile_season_unique` ON `owner_teams` (`profile_id`,`season`);--> statement-breakpoint
CREATE INDEX `owner_teams_season_ovr_idx` ON `owner_teams` (`season`,`ovr`);--> statement-breakpoint
CREATE INDEX `owner_teams_season_rating_idx` ON `owner_teams` (`season`,`rating`);