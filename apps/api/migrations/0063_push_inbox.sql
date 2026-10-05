CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`source_key` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`target_json` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	`push_reserved_at` text,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_source_unique` ON `notifications` (`profile_id`,`source_key`);--> statement-breakpoint
CREATE INDEX `notifications_profile_created_idx` ON `notifications` (`profile_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `notifications_profile_read_created_idx` ON `notifications` (`profile_id`,`read_at`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `notifications_expires_idx` ON `notifications` (`expires_at`);--> statement-breakpoint
CREATE INDEX `notifications_profile_push_reserved_idx` ON `notifications` (`profile_id`,`push_reserved_at`);--> statement-breakpoint
CREATE TABLE `push_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`notification_id` text NOT NULL,
	`installation_hash` text NOT NULL,
	`session_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`token` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`receipt_attempts` integer DEFAULT 0 NOT NULL,
	`due_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`lease_id` text,
	`ticket_id` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_deliveries_device_unique` ON `push_deliveries` (`notification_id`,`installation_hash`);--> statement-breakpoint
CREATE INDEX `push_deliveries_due_idx` ON `push_deliveries` (`state`,`due_at`);--> statement-breakpoint
CREATE INDEX `push_deliveries_installation_idx` ON `push_deliveries` (`installation_hash`);--> statement-breakpoint
CREATE INDEX `push_deliveries_profile_idx` ON `push_deliveries` (`profile_id`);--> statement-breakpoint
CREATE INDEX `push_deliveries_session_idx` ON `push_deliveries` (`session_id`);--> statement-breakpoint
CREATE INDEX `push_deliveries_expires_idx` ON `push_deliveries` (`expires_at`);--> statement-breakpoint
ALTER TABLE `push_devices` ADD `engagement_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `push_devices_engagement_updated_idx` ON `push_devices` (`engagement_enabled`,`updated_at`);