CREATE TABLE `push_news_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`installation_hash` text NOT NULL,
	`session_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`token` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`receipt_attempts` integer DEFAULT 0 NOT NULL,
	`due_at` text NOT NULL,
	`lease_id` text,
	`ticket_id` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `push_news_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_news_deliveries_device_unique` ON `push_news_deliveries` (`event_id`,`installation_hash`);--> statement-breakpoint
CREATE INDEX `push_news_deliveries_due_idx` ON `push_news_deliveries` (`state`,`due_at`);--> statement-breakpoint
CREATE INDEX `push_news_deliveries_session_idx` ON `push_news_deliveries` (`session_id`);--> statement-breakpoint
CREATE INDEX `push_news_deliveries_profile_idx` ON `push_news_deliveries` (`profile_id`);--> statement-breakpoint
CREATE INDEX `push_news_deliveries_installation_idx` ON `push_news_deliveries` (`installation_hash`);--> statement-breakpoint
CREATE TABLE `push_news_events` (
	`id` text PRIMARY KEY NOT NULL,
	`board` text NOT NULL,
	`day` text NOT NULL,
	`post_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_news_events_day_unique` ON `push_news_events` (`board`,`day`);--> statement-breakpoint
CREATE INDEX `push_news_events_expires_idx` ON `push_news_events` (`expires_at`);