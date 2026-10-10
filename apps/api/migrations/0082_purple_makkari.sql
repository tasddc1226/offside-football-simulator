CREATE TABLE `owner_title_awards` (
	`profile_id` text NOT NULL,
	`title_id` text NOT NULL,
	`criteria_version` integer NOT NULL,
	`evidence` integer NOT NULL,
	`earned_at` text NOT NULL,
	`seen_at` text,
	PRIMARY KEY(`profile_id`, `title_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `owner_title_progress` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`retired` integer NOT NULL,
	`elite` integer NOT NULL,
	`ballon` integer NOT NULL,
	`numbers` integer NOT NULL,
	`firsts` integer NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `profiles` ADD `title` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `title_pinned` integer DEFAULT 0 NOT NULL;