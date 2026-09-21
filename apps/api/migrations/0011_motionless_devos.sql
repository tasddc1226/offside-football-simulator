CREATE TABLE `friendly_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_profile_id` text NOT NULL,
	`request_key_hash` text NOT NULL,
	`request_hash` text NOT NULL,
	`receipt_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friendly_matches_request_key_hash_unique` ON `friendly_matches` (`request_key_hash`);--> statement-breakpoint
CREATE INDEX `friendly_matches_owner_idx` ON `friendly_matches` (`owner_profile_id`,`created_at`);