CREATE TABLE `push_devices` (
	`installation_hash` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`token` text NOT NULL,
	`platform` text NOT NULL,
	`app_version` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_devices_token_unique` ON `push_devices` (`token`);--> statement-breakpoint
CREATE INDEX `push_devices_session_idx` ON `push_devices` (`session_id`);--> statement-breakpoint
CREATE INDEX `push_devices_profile_idx` ON `push_devices` (`profile_id`);--> statement-breakpoint
CREATE INDEX `push_devices_updated_idx` ON `push_devices` (`updated_at`);