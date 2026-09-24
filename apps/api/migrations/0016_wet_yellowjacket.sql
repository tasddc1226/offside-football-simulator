CREATE TABLE `career_seasons` (
	`career_id` text NOT NULL,
	`year` integer NOT NULL,
	`age` integer NOT NULL,
	`club` text NOT NULL,
	`league` text NOT NULL,
	`apps` integer NOT NULL,
	`goals` integer NOT NULL,
	`assists` integer NOT NULL,
	`rating` real NOT NULL,
	`rank` text NOT NULL,
	`ovr` integer NOT NULL,
	`honors_json` text NOT NULL,
	`mil` integer NOT NULL,
	`events_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`career_id`, `year`),
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `careers` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`pos` text NOT NULL,
	`foot` text NOT NULL,
	`type` text NOT NULL,
	`trait` text NOT NULL,
	`start_year` integer NOT NULL,
	`status` text NOT NULL,
	`app_version` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`retired_at` text,
	`retire_age` integer,
	`peak` integer,
	`legend_score` integer,
	`apps` integer,
	`goals` integer,
	`assists` integer,
	`trophies` integer,
	`awards` integer,
	`caps` integer,
	`ballon` integer,
	`last_club` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `careers_profile_id_idx` ON `careers` (`profile_id`);