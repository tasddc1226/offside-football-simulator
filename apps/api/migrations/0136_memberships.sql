CREATE TABLE `memberships` (
	`store` text NOT NULL,
	`chain_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`until` text NOT NULL,
	`auto_renew` integer,
	`test` integer DEFAULT false NOT NULL,
	`verified_at` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`store`, `chain_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `memberships_profile_idx` ON `memberships` (`profile_id`,`until`);