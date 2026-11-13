CREATE TABLE `daily_rank_winners` (
	`day` text NOT NULL,
	`rank` integer NOT NULL,
	`career_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`legend_score` integer NOT NULL,
	`reroll` integer DEFAULT 0 NOT NULL,
	`scout` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`day`, `rank`)
);
--> statement-breakpoint
CREATE INDEX `daily_rank_winners_profile_idx` ON `daily_rank_winners` (`profile_id`,`day`);--> statement-breakpoint
CREATE INDEX `daily_rank_winners_career_idx` ON `daily_rank_winners` (`career_id`);