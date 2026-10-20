DROP INDEX `market_listings_new_idx`;--> statement-breakpoint
DROP INDEX `market_listings_price_idx`;--> statement-breakpoint
DROP INDEX `market_listings_sold_idx`;--> statement-breakpoint
CREATE INDEX `market_listings_new_idx` ON `market_listings` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `market_listings_price_idx` ON `market_listings` (`status`,`price`,`created_at`);--> statement-breakpoint
CREATE INDEX `market_listings_sold_idx` ON `market_listings` (`status`,`closed_at`);