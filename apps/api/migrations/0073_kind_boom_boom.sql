CREATE TABLE `translations` (
	`key` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `translations_created_idx` ON `translations` (`created_at`);--> statement-breakpoint
ALTER TABLE `board_posts` ADD `i18n_json` text;