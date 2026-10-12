CREATE INDEX `billing_alerts_daily_idx` ON `billing_alerts` (`test`,`created_at`);--> statement-breakpoint
CREATE INDEX `profiles_created_idx` ON `profiles` (`created_at`);--> statement-breakpoint
CREATE INDEX `profiles_last_seen_idx` ON `profiles` (`last_seen_at`);