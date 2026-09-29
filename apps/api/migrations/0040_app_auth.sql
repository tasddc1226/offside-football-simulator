CREATE TABLE `app_auth_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`challenge` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`outcome` text,
	`outcome_profile_id` text,
	`reason` text,
	`used_at` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `app_auth_tickets_expires_at_idx` ON `app_auth_tickets` (`expires_at`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `apple_sub` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `apple_linked_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_apple_sub_unique` ON `profiles` (`apple_sub`);