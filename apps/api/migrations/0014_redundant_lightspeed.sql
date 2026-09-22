CREATE TABLE `annual_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`career_id` text NOT NULL,
	`run_id` text,
	`from_revision` integer,
	`request_key_hash` text NOT NULL,
	`request_hash` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `annual_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `annual_requests_key_unique` ON `annual_requests` (`request_key_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `annual_requests_run_revision_unique` ON `annual_requests` (`run_id`,`from_revision`);--> statement-breakpoint
CREATE TABLE `annual_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`career_id` text NOT NULL,
	`start_revision` integer NOT NULL,
	`revision` integer NOT NULL,
	`career_revision` integer NOT NULL,
	`status` text NOT NULL,
	`checkpoint_json` text NOT NULL,
	`start_snapshot_json` text NOT NULL,
	`decision_json` text,
	`report_json` text,
	`command_count` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `annual_runs_career_start_unique` ON `annual_runs` (`career_id`,`start_revision`);--> statement-breakpoint
ALTER TABLE `careers` ADD `authority` text DEFAULT 'CLIENT_LOCAL' NOT NULL;