ALTER TABLE `careers` ADD `detail_archive_key` text;--> statement-breakpoint
CREATE INDEX `careers_detail_archive_idx` ON `careers` (`detail_archive_key`);--> statement-breakpoint
CREATE INDEX `market_listings_career_idx` ON `market_listings` (`career_id`);--> statement-breakpoint
CREATE INDEX `owner_season_records_best_career_idx` ON `owner_season_records` (`best_career_id`);--> statement-breakpoint
CREATE INDEX `server_firsts_career_idx` ON `server_firsts` (`career_id`);--> statement-breakpoint
CREATE INDEX `server_records_career_idx` ON `server_records` (`career_id`);