CREATE TABLE `owner_achievements` (
	`profile_id` text NOT NULL,
	`season` integer NOT NULL,
	`score` integer NOT NULL,
	`done` integer NOT NULL,
	`players` integer NOT NULL,
	`reached_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`profile_id`, `season`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `owner_achievements_season_score_idx` ON `owner_achievements` (`season`,`score`,`reached_at`);