CREATE TABLE `api_status_buckets` (
	`bucket` text PRIMARY KEY NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	`total_ms` integer DEFAULT 0 NOT NULL,
	`slow` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`subject` text NOT NULL,
	`window_start` text NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_attempts_kind_subject_unique` ON `auth_attempts` (`kind`,`subject`);--> statement-breakpoint
CREATE TABLE `client_errors` (
	`day` text NOT NULL,
	`fingerprint` text NOT NULL,
	`platform` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`frame` text NOT NULL,
	`place` text NOT NULL,
	`stack` text NOT NULL,
	`first_version` text NOT NULL,
	`last_version` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`first_at` text NOT NULL,
	`last_at` text NOT NULL,
	PRIMARY KEY(`day`, `fingerprint`)
);
--> statement-breakpoint
CREATE INDEX `client_errors_last_at_idx` ON `client_errors` (`last_at`);--> statement-breakpoint
CREATE TABLE `kpi_daily` (
	`day` text NOT NULL,
	`metric` text NOT NULL,
	`dim` text DEFAULT 'all' NOT NULL,
	`value` real NOT NULL,
	`source` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`day`, `metric`, `dim`)
);
