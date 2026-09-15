CREATE TABLE `notices` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`published_at` text NOT NULL,
	`is_published` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notices_is_published_published_at_idx` ON `notices` (`is_published`,`published_at`);