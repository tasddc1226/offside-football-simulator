CREATE TABLE `membership_chains` (
	`store` text NOT NULL,
	`environment` text NOT NULL,
	`chain_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`status` text NOT NULL,
	`paid_until` text NOT NULL,
	`grace_until` text,
	`auto_renew` integer NOT NULL,
	`verified_at` text NOT NULL,
	`token_cipher` text,
	PRIMARY KEY(`store`, `environment`, `chain_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `membership_chains_owner` ON `membership_chains` (`profile_id`,`environment`,`paid_until`);--> statement-breakpoint
CREATE INDEX `membership_chains_reconcile` ON `membership_chains` (`verified_at`);--> statement-breakpoint
CREATE TABLE `membership_item_lots` (
	`store` text NOT NULL,
	`environment` text NOT NULL,
	`transaction_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`item` text NOT NULL,
	`granted` integer NOT NULL,
	`remaining` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`store`, `environment`, `transaction_id`, `item`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "membership_item_lots_remaining" CHECK("membership_item_lots"."remaining" >= 0 and "membership_item_lots"."remaining" <= "membership_item_lots"."granted")
);
--> statement-breakpoint
CREATE INDEX `membership_item_lots_spend` ON `membership_item_lots` (`profile_id`,`item`,`created_at`);