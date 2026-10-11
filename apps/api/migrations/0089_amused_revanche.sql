CREATE TABLE `career_reminder_outcomes` (
	`notification_id` text PRIMARY KEY NOT NULL,
	`stage` integer NOT NULL,
	`returned_at` text,
	`retired_at` text,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `career_activity` ADD `lang` text DEFAULT 'ko' NOT NULL;