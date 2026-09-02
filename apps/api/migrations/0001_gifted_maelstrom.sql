CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`profile_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_profile_id_idx` ON `audit_log` (`profile_id`);--> statement-breakpoint
CREATE TABLE `auth_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`subject` text NOT NULL,
	`window_start` text NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_attempts_kind_subject_unique` ON `auth_attempts` (`kind`,`subject`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `deleted_at` text;