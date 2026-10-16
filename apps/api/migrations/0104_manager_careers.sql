CREATE TABLE `manager_careers` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`career_id` text NOT NULL,
	`status` text NOT NULL,
	`seed` integer NOT NULL,
	`origin_json` text NOT NULL,
	`result_json` text,
	`service_season` integer,
	`created_at` text NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manager_careers_active_unique` ON `manager_careers` (`profile_id`) WHERE "manager_careers"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `manager_careers_card_unique` ON `manager_careers` (`career_id`);--> statement-breakpoint
CREATE INDEX `manager_careers_profile_idx` ON `manager_careers` (`profile_id`,`status`,`finished_at`);--> statement-breakpoint
ALTER TABLE `cards` ADD `manager` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `owner_teams` ADD `coach_id` text;