CREATE TABLE `career_activity` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`career_id` text,
	`lang` text DEFAULT 'ko' NOT NULL,
	`state` text NOT NULL,
	`last_active_at` text NOT NULL,
	`retired_at` text,
	`reminder_stage` integer DEFAULT 0 NOT NULL,
	`last_reminder_at` text,
	`reminder_batch` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `career_activity_candidate_idx` ON `career_activity` (`state`,`retired_at`,`last_active_at`);--> statement-breakpoint
CREATE INDEX `career_activity_batch_idx` ON `career_activity` (`reminder_batch`);--> statement-breakpoint
CREATE TABLE `career_reminder_outcomes` (
	`notification_id` text PRIMARY KEY NOT NULL,
	`stage` integer NOT NULL,
	`returned_at` text,
	`retired_at` text,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `push_devices_profile_updated_idx` ON `push_devices` (`profile_id`,`updated_at`,`installation_hash`);