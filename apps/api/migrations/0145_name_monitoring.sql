ALTER TABLE `owner_teams` ADD `name_changed_at` text;--> statement-breakpoint
CREATE INDEX `owner_teams_name_changed_idx` ON `owner_teams` (`name_changed_at`) WHERE "owner_teams"."name_changed_at" is not null;--> statement-breakpoint
ALTER TABLE `profiles` ADD `nickname_set_at` text;--> statement-breakpoint
CREATE INDEX `profiles_nickname_set_idx` ON `profiles` (`nickname_set_at`) WHERE "profiles"."nickname_set_at" is not null;--> statement-breakpoint
CREATE INDEX `board_comment_reports_created_idx` ON `board_comment_reports` (`created_at`);--> statement-breakpoint
CREATE INDEX `team_comment_reports_created_idx` ON `team_comment_reports` (`created_at`);