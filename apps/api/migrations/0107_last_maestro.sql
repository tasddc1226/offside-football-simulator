ALTER TABLE `career_seasons` ADD `upload_hash` text;--> statement-breakpoint
ALTER TABLE `career_seasons` ADD `upload_revision` integer DEFAULT 0 NOT NULL;