CREATE TABLE `cup_predictions` (
	`cup_id` text NOT NULL,
	`match_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`pick` text NOT NULL,
	`correct` integer,
	`settled_at` text,
	`rewarded_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`match_id`, `profile_id`),
	FOREIGN KEY (`match_id`) REFERENCES `cup_matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cup_predictions_pick_check" CHECK("cup_predictions"."pick" IN ('home', 'draw', 'away'))
);
--> statement-breakpoint
CREATE INDEX `cup_predictions_cup_match_pick_idx` ON `cup_predictions` (`cup_id`,`match_id`,`pick`);--> statement-breakpoint
CREATE INDEX `cup_predictions_profile_cup_idx` ON `cup_predictions` (`profile_id`,`cup_id`);