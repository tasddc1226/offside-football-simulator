CREATE TABLE `iap_purchases` (
	`store` text NOT NULL,
	`transaction_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`product_id` text NOT NULL,
	`item` text NOT NULL,
	`qty` integer NOT NULL,
	`test` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`store`, `transaction_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `iap_purchases_profile_idx` ON `iap_purchases` (`profile_id`,`created_at`);