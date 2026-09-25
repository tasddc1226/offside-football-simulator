CREATE INDEX `career_seasons_created_idx` ON `career_seasons` (`created_at`);--> statement-breakpoint
CREATE INDEX `careers_status_updated_idx` ON `careers` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `careers_created_idx` ON `careers` (`created_at`);--> statement-breakpoint
CREATE INDEX `careers_status_retired_idx` ON `careers` (`status`,`retired_at`);