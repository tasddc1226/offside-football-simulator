CREATE TABLE `retention_pushes` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`campaign` text NOT NULL,
	`stage` integer NOT NULL,
	`story` text NOT NULL,
	`variant` text NOT NULL,
	`lapse_key` text NOT NULL,
	`notification_id` text,
	`created_at` text NOT NULL,
	`returned_at` text,
	`progressed_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `retention_pushes_step_unique` ON `retention_pushes` (`profile_id`,`campaign`,`stage`,`lapse_key`);--> statement-breakpoint
CREATE INDEX `retention_pushes_created_idx` ON `retention_pushes` (`created_at`);--> statement-breakpoint
CREATE INDEX `retention_pushes_notification_idx` ON `retention_pushes` (`notification_id`);--> statement-breakpoint
ALTER TABLE `push_preferences` ADD `nudge` integer DEFAULT true NOT NULL;