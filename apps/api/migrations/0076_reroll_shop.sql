CREATE TABLE `owner_item_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`item` text NOT NULL,
	`qty` integer NOT NULL,
	`price` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `owner_item_purchases_profile_idx` ON `owner_item_purchases` (`profile_id`,`item`,`created_at`);