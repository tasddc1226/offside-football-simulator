CREATE TABLE `market_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`career_id` text NOT NULL,
	`seller_id` text NOT NULL,
	`buyer_id` text,
	`season` integer NOT NULL,
	`price` integer NOT NULL,
	`fee` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`closed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_listings_open_card_unique` ON `market_listings` (`career_id`) WHERE "market_listings"."status" = 'open';--> statement-breakpoint
CREATE INDEX `market_listings_new_idx` ON `market_listings` (`status`,`season`,`created_at`);--> statement-breakpoint
CREATE INDEX `market_listings_price_idx` ON `market_listings` (`status`,`season`,`price`,`created_at`);--> statement-breakpoint
CREATE INDEX `market_listings_seller_idx` ON `market_listings` (`seller_id`,`status`,`closed_at`);--> statement-breakpoint
CREATE INDEX `market_listings_buyer_idx` ON `market_listings` (`buyer_id`,`closed_at`);--> statement-breakpoint
CREATE TABLE `owner_funds` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "owner_funds_balance_check" CHECK("owner_funds"."balance" >= 0)
);
