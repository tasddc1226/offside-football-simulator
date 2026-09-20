CREATE TABLE `locker_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_profile_id` text NOT NULL,
	`name` text NOT NULL,
	`formation` text NOT NULL,
	`lineup_json` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `locker_teams_owner_idx` ON `locker_teams` (`owner_profile_id`);