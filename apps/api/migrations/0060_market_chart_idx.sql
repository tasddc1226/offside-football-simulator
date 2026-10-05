CREATE INDEX `market_daily_day_idx` ON `market_daily` (`season`,`day`);--> statement-breakpoint
CREATE INDEX `market_listings_card_idx` ON `market_listings` (`career_id`,`status`,`closed_at`);