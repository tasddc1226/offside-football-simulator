CREATE TABLE `owner_attendance` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`stamps` integer DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`best_streak` integer DEFAULT 0 NOT NULL,
	`last_day` text,
	`grace_week` text,
	`claim_id` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `owner_attendance_days` (
	`profile_id` text NOT NULL,
	`day` text NOT NULL,
	`checked_at` text NOT NULL,
	PRIMARY KEY(`profile_id`, `day`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
