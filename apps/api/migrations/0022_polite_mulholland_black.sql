CREATE TABLE `balance_versions` (
	`version` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`values_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`activated_at` text
);
--> statement-breakpoint
CREATE INDEX `balance_versions_status_idx` ON `balance_versions` (`status`);--> statement-breakpoint
CREATE INDEX `board_comments_created_idx` ON `board_comments` (`created_at`);