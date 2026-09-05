CREATE TABLE `career_archives` (
	`career_id` text PRIMARY KEY NOT NULL,
	`retirement_revision` integer NOT NULL,
	`archive_hash` text NOT NULL,
	`archive_json` text NOT NULL,
	`legacy_version` text NOT NULL,
	`legacy_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
