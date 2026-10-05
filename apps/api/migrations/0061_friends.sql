CREATE TABLE `friend_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`opponent_id` text NOT NULL,
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
CREATE INDEX `friend_matches_profile_created_idx` ON `friend_matches` (`profile_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `friend_matches_opponent_created_idx` ON `friend_matches` (`opponent_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `friend_matches_home_team_idx` ON `friend_matches` (`home_team_id`);--> statement-breakpoint
CREATE INDEX `friend_matches_away_team_idx` ON `friend_matches` (`away_team_id`);--> statement-breakpoint
CREATE TABLE `friends` (
	`profile_id` text NOT NULL,
	`friend_id` text NOT NULL,
	`state` text NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`draws` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`profile_id`, `friend_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friend_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `friends_friend_idx` ON `friends` (`friend_id`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `friend_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_friend_code_unique` ON `profiles` (`friend_code`);