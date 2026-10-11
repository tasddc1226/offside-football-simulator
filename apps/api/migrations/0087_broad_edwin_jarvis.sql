CREATE TABLE `career_activity` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`career_id` text,
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
CREATE INDEX `career_activity_batch_idx` ON `career_activity` (`reminder_batch`);