CREATE TABLE `starter_packs` (
	`store` text NOT NULL,
	`transaction_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`version` text NOT NULL,
	`test` integer DEFAULT false NOT NULL,
	`grant_id` text NOT NULL,
	`created_at` text NOT NULL,
	`purchased_at` text,
	`price_milliunits` integer,
	`currency` text,
	`storefront` text,
	`refunded_at` text,
	`revoked_json` text,
	PRIMARY KEY(`store`, `transaction_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `starter_packs_profile_idx` ON `starter_packs` (`profile_id`,`created_at`);