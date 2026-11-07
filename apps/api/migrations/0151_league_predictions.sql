CREATE TABLE `league_predictions` (
	`season` integer NOT NULL,
	`match_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`pick` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`match_id`, `profile_id`),
	FOREIGN KEY (`match_id`) REFERENCES `league_matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "league_predictions_pick_check" CHECK("league_predictions"."pick" IN ('home', 'draw', 'away'))
);
--> statement-breakpoint
CREATE INDEX `league_predictions_match_pick_idx` ON `league_predictions` (`match_id`,`pick`);--> statement-breakpoint
CREATE INDEX `league_predictions_profile_season_idx` ON `league_predictions` (`profile_id`,`season`);