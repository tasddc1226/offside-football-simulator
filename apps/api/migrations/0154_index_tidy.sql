DROP INDEX `careers_profile_id_idx`;--> statement-breakpoint
DROP INDEX `push_devices_profile_idx`;--> statement-breakpoint
DROP INDEX `team_matches_away_created_idx`;--> statement-breakpoint
CREATE INDEX `best11_changes_in_career_idx` ON `best11_changes` (`in_career_id`);--> statement-breakpoint
CREATE INDEX `best11_changes_out_career_idx` ON `best11_changes` (`out_career_id`);--> statement-breakpoint
CREATE INDEX `best11_slots_career_idx` ON `best11_slots` (`career_id`);--> statement-breakpoint
CREATE INDEX `team_live_matches_home_team_idx` ON `team_live_matches` (`home_team_id`);--> statement-breakpoint
CREATE INDEX `team_live_matches_away_team_idx` ON `team_live_matches` (`away_team_id`);