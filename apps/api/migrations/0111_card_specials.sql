CREATE TABLE `card_specials` (
	`career_id` text NOT NULL,
	`season` integer NOT NULL,
	`kind` text NOT NULL,
	`rank` integer NOT NULL,
	`rule_version` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`career_id`, `season`, `kind`)
);
--> statement-breakpoint
CREATE INDEX `card_specials_season_idx` ON `card_specials` (`season`,`kind`,`rank`);