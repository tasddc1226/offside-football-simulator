CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`profile_id` text,
	`name` text NOT NULL,
	`props_json` text NOT NULL,
	`client_ts` integer NOT NULL,
	`received_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_events_client_id_idx` ON `analytics_events` (`client_id`);--> statement-breakpoint
ALTER TABLE `service_seasons` ADD `is_test` integer DEFAULT 0 NOT NULL;